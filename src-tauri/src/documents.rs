use cap_std::fs::{Dir, File};
use serde::Serialize;
use std::{io::Read, path::Path, path::PathBuf};

pub const MAX_DOCUMENT_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: u64,
    pub name: String,
    pub path: String,
    pub content: String,
}

pub struct OpenDocument {
    pub snapshot: Document,
    pub root: Dir,
    pub path: PathBuf,
    pub relative: PathBuf,
}

pub fn validate_extension(path: &Path) -> Result<(), String> {
    match path.extension().and_then(|ext| ext.to_str()) {
        Some(ext) if ext.eq_ignore_ascii_case("md") || ext.eq_ignore_ascii_case("markdown") => {
            Ok(())
        }
        _ => Err("Choose a Markdown file (.md or .markdown).".into()),
    }
}

pub fn read_bounded(file: File, limit: u64) -> Result<Vec<u8>, String> {
    let metadata = file.metadata().map_err(|_| "Could not inspect the file.")?;
    if !metadata.is_file() {
        return Err("Choose a regular file, not a directory or device.".into());
    }
    if metadata.len() > limit {
        return Err(format!(
            "The file exceeds the {} MiB limit.",
            limit / 1024 / 1024
        ));
    }
    let mut bytes = Vec::new();
    file.take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| "Could not read the file. Check its permissions and try again.")?;
    if bytes.len() as u64 > limit {
        return Err("The file grew beyond the size limit while opening it.".into());
    }
    Ok(bytes)
}

pub fn read_markdown(root: &Dir, relative: &Path) -> Result<String, String> {
    validate_extension(relative)?;
    let file = root.open(relative).map_err(|_| {
        "Could not open this file. It may be missing, inaccessible, or outside the document folder."
    })?;
    let bytes = read_bounded(file, MAX_DOCUMENT_BYTES)?;
    let content = String::from_utf8(bytes)
        .map_err(|_| "This file is not valid UTF-8. Convert it to UTF-8 in a text editor.")?;
    Ok(content
        .strip_prefix('\u{feff}')
        .unwrap_or(&content)
        .to_owned())
}

impl OpenDocument {
    pub fn selected(path: &Path, id: u64) -> Result<Self, String> {
        validate_extension(path)?;
        let metadata = std::fs::metadata(path)
            .map_err(|_| "Could not find or access this file. Check its path and permissions.")?;
        if !metadata.is_file() {
            return Err("Choose a regular Markdown file, not a directory or device.".into());
        }
        let path = path
            .canonicalize()
            .map_err(|_| "Could not resolve this file's path.")?;
        validate_extension(&path)?;
        let parent = path.parent().ok_or("This file has no parent folder.")?;
        let relative = PathBuf::from(path.file_name().ok_or("This file has no name.")?);
        let root = Dir::open_ambient_dir(parent, cap_std::ambient_authority())
            .map_err(|_| "Could not access the document folder.")?;
        let content = read_markdown(&root, &relative)?;
        let snapshot = Document {
            id,
            name: relative.to_string_lossy().into_owned(),
            path: path.to_string_lossy().into_owned(),
            content,
        };
        Ok(Self {
            snapshot,
            root,
            path,
            relative,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selected_files_are_bounded_utf8_markdown() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("متن with spaces.MD");
        std::fs::write(&path, "\u{feff}# سلام\nHello").unwrap();
        let opened = OpenDocument::selected(&path, 1).unwrap();
        assert_eq!(opened.snapshot.content, "# سلام\nHello");
        assert!(opened.snapshot.path.contains("متن with spaces.MD"));
        std::fs::write(&path, [0xff, 0xfe]).unwrap();
        assert!(OpenDocument::selected(&path, 2)
            .err()
            .unwrap()
            .contains("UTF-8"));
    }

    #[test]
    fn rejects_missing_directory_unsupported_and_oversized() {
        let dir = tempfile::tempdir().unwrap();
        assert!(OpenDocument::selected(&dir.path().join("absent.md"), 1).is_err());
        let folder = dir.path().join("directory.md");
        std::fs::create_dir(&folder).unwrap();
        assert!(OpenDocument::selected(&folder, 1).is_err());
        let text = dir.path().join("file.txt");
        std::fs::write(&text, "text").unwrap();
        assert!(OpenDocument::selected(&text, 1).is_err());
        let large = dir.path().join("large.markdown");
        std::fs::File::create(&large)
            .unwrap()
            .set_len(MAX_DOCUMENT_BYTES + 1)
            .unwrap();
        assert!(OpenDocument::selected(&large, 1).is_err());
        let empty = dir.path().join("empty.md");
        std::fs::write(&empty, "").unwrap();
        assert!(OpenDocument::selected(&empty, 1)
            .unwrap()
            .snapshot
            .content
            .is_empty());
    }
}
