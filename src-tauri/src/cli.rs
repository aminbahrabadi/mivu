use std::{
    ffi::OsString,
    path::{Path, PathBuf},
};

pub fn document_argument(
    args: impl IntoIterator<Item = OsString>,
    cwd: &Path,
) -> Result<Option<PathBuf>, String> {
    let mut args = args.into_iter().skip(1);
    let mut next = args.next();
    if next.as_deref() == Some(std::ffi::OsStr::new("--")) {
        next = args.next();
    }
    let Some(value) = next else {
        return Ok(None);
    };
    if args.next().is_some() {
        return Err("Open one document at a time: mivu [path/to/file.md]".into());
    }
    let path = PathBuf::from(value);
    Ok(Some(if path.is_absolute() {
        path
    } else {
        cwd.join(path)
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn resolves_relative_unicode_paths_against_the_launching_process() {
        let args = ["mivu", "folder/سلام world.md"].map(OsString::from);
        assert_eq!(
            document_argument(args, Path::new("/caller")).unwrap(),
            Some(PathBuf::from("/caller/folder/سلام world.md"))
        );
        assert_eq!(
            document_argument(
                ["mivu", "--", "/absolute/file.md"].map(OsString::from),
                Path::new("/caller")
            )
            .unwrap(),
            Some(PathBuf::from("/absolute/file.md"))
        );
        assert!(document_argument(
            ["mivu", "a.md", "b.md"].map(OsString::from),
            Path::new("/caller")
        )
        .is_err());
        assert_eq!(
            document_argument(["mivu"].map(OsString::from), Path::new("/caller")).unwrap(),
            None
        );
    }
}
