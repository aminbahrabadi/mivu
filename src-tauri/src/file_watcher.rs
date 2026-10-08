use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    path::Path,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread,
    time::{Duration, Instant},
};

pub enum WatchNotice {
    Changed,
    Failed,
}

pub struct DocumentWatcher {
    _watcher: RecommendedWatcher,
    stop: Arc<AtomicBool>,
}

impl DocumentWatcher {
    pub fn new(
        path: &Path,
        callback: impl Fn(WatchNotice) + Send + 'static,
    ) -> Result<Self, String> {
        let (sender, receiver) = mpsc::sync_channel(64);
        let mut watcher = notify::recommended_watcher(move |event: notify::Result<Event>| {
            let _ = sender.try_send(event);
        })
        .map_err(|_| "Automatic refresh could not start. Reopen this file to try again.")?;
        let parent = path.parent().ok_or("The document has no parent folder.")?;
        watcher
            .watch(parent, RecursiveMode::NonRecursive)
            .map_err(|_| {
                "Automatic refresh could not watch this folder. Reopen the file to try again."
            })?;
        let target = path.to_owned();
        let stop = Arc::new(AtomicBool::new(false));
        let stopped = stop.clone();
        thread::spawn(move || {
            let relevant = |event: &notify::Result<Event>| match event {
                Ok(event) => {
                    !matches!(event.kind, EventKind::Access(_))
                        && (event.paths.is_empty() || event.paths.contains(&target))
                }
                Err(_) => true,
            };
            while !stopped.load(Ordering::Acquire) {
                let event = match receiver.recv_timeout(Duration::from_millis(100)) {
                    Ok(event) if relevant(&event) => event,
                    Ok(_) | Err(mpsc::RecvTimeoutError::Timeout) => continue,
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                };
                let first = Instant::now();
                let mut last = first;
                let mut failed = event.is_err();
                loop {
                    if stopped.load(Ordering::Acquire) {
                        return;
                    }
                    let quiet = Duration::from_millis(180).saturating_sub(last.elapsed());
                    let maximum = Duration::from_millis(600).saturating_sub(first.elapsed());
                    if quiet.is_zero() || maximum.is_zero() {
                        break;
                    }
                    match receiver.recv_timeout(quiet.min(maximum)) {
                        Ok(event) if relevant(&event) => {
                            last = Instant::now();
                            failed |= event.is_err();
                        }
                        Ok(_) => {}
                        Err(mpsc::RecvTimeoutError::Timeout) => break,
                        Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    }
                }
                if !stopped.load(Ordering::Acquire) {
                    callback(if failed {
                        WatchNotice::Failed
                    } else {
                        WatchNotice::Changed
                    });
                }
            }
        });
        Ok(Self {
            _watcher: watcher,
            stop,
        })
    }
}

impl Drop for DocumentWatcher {
    fn drop(&mut self) {
        // Joining here could deadlock a callback waiting for the document-state lock.
        self.stop.store(true, Ordering::Release);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn catches_atomic_replacement_ignores_neighbors_and_stops_on_drop() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("file.md");
        std::fs::write(&path, "initial").unwrap();
        let (sender, receiver) = mpsc::channel();
        let watcher = DocumentWatcher::new(&path, move |notice| {
            if matches!(notice, WatchNotice::Changed) {
                let _ = sender.send(());
            }
        })
        .unwrap();
        std::fs::write(dir.path().join("unrelated.md"), "unrelated").unwrap();
        assert!(receiver.recv_timeout(Duration::from_millis(300)).is_err());
        for index in 0..5 {
            std::fs::write(&path, format!("{index}")).unwrap();
        }
        receiver.recv_timeout(Duration::from_secs(3)).unwrap();
        assert!(receiver.recv_timeout(Duration::from_millis(300)).is_err());
        let temp = dir.path().join("atomic.tmp");
        std::fs::write(&temp, "replacement").unwrap();
        std::fs::rename(temp, &path).unwrap();
        receiver.recv_timeout(Duration::from_secs(3)).unwrap();
        drop(watcher);
        std::fs::write(&path, "after cleanup").unwrap();
        assert!(receiver.recv_timeout(Duration::from_millis(400)).is_err());
    }
}
