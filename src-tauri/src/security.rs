pub fn validate_external(value: &str) -> Result<url::Url, String> {
    let url = url::Url::parse(value).map_err(|_| "This link is not a valid URL.")?;
    if !matches!(url.scheme(), "https" | "http" | "mailto")
        || !url.username().is_empty()
        || url.password().is_some()
        || value.chars().any(char::is_control)
    {
        return Err("Only HTTP, HTTPS, and mail links can be opened externally.".into());
    }
    Ok(url)
}

pub fn allowed_navigation(url: &url::Url) -> bool {
    let root = matches!(url.path(), "" | "/" | "/index.html") && url.query().is_none();
    let packaged = (url.scheme() == "tauri" && url.host_str() == Some("localhost"))
        || (matches!(url.scheme(), "http" | "https")
            && url.host_str() == Some("tauri.localhost")
            && url.port().is_none());
    let development = cfg!(debug_assertions)
        && url.scheme() == "http"
        && url.host_str() == Some("127.0.0.1")
        && url.port() == Some(1420);
    root && (packaged || development)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn keeps_external_destinations_out_of_the_webview() {
        for value in [
            "javascript:alert(1)",
            "data:text/html,x",
            "file:///etc/passwd",
            "https://user:secret@example.org",
            "https://example.org/\n",
        ] {
            assert!(validate_external(value).is_err(), "{value}");
        }
        for value in [
            "https://example.org/docs",
            "http://example.org/",
            "mailto:maintainer@example.org",
        ] {
            assert!(validate_external(value).is_ok());
        }
        for value in [
            "https://example.org/",
            "http://tauri.localhost:9999/",
            "tauri://evil/",
            "tauri://localhost/other.html",
            "file:///etc/passwd",
        ] {
            assert!(!allowed_navigation(&url::Url::parse(value).unwrap()));
        }
        assert!(allowed_navigation(
            &url::Url::parse("tauri://localhost/#heading").unwrap()
        ));
        assert!(allowed_navigation(&url::Url::parse("tauri://localhost").unwrap()));
    }
}
