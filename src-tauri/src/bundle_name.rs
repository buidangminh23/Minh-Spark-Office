use std::path::{Path, PathBuf};

const LEGACY_BUNDLE: &str = "Minh Spark Office.app";
const CURRENT_BUNDLE: &str = "Office 23.app";

pub fn rename_plan(executable: &Path) -> Option<(PathBuf, PathBuf)> {
    let macos_dir = executable.parent()?;
    let contents = macos_dir.parent()?;
    let bundle = contents.parent()?;
    if macos_dir.file_name()? != "MacOS" || contents.file_name()? != "Contents" {
        return None;
    }
    if bundle.file_name()? != LEGACY_BUNDLE {
        return None;
    }
    let target = bundle.parent()?.join(CURRENT_BUNDLE);
    Some((bundle.to_path_buf(), target))
}

#[cfg(target_os = "macos")]
pub fn rename_legacy_bundle() {
    let Ok(executable) = std::env::current_exe() else {
        return;
    };
    let Some((legacy, target)) = rename_plan(&executable) else {
        return;
    };
    if target.exists() || !legacy.is_dir() {
        return;
    }
    if std::fs::rename(&legacy, &target).is_ok() {
        let _ = std::process::Command::new(
            "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister",
        )
        .arg("-f")
        .arg(&target)
        .spawn();
    }
}

#[cfg(test)]
mod tests {
    use super::rename_plan;
    use std::path::{Path, PathBuf};

    #[test]
    fn legacy_bundle_is_renamed_beside_itself() {
        let plan = rename_plan(Path::new(
            "/Applications/Minh Spark Office.app/Contents/MacOS/minh-spark-office",
        ));
        assert_eq!(
            plan,
            Some((
                PathBuf::from("/Applications/Minh Spark Office.app"),
                PathBuf::from("/Applications/Office 23.app"),
            ))
        );
    }

    #[test]
    fn user_applications_folder_is_kept() {
        let plan = rename_plan(Path::new(
            "/Users/a/Applications/Minh Spark Office.app/Contents/MacOS/minh-spark-office",
        ));
        assert_eq!(plan.map(|(_, target)| target), Some(PathBuf::from("/Users/a/Applications/Office 23.app")));
    }

    #[test]
    fn current_or_unrelated_locations_are_left_alone() {
        for path in [
            "/Applications/Office 23.app/Contents/MacOS/minh-spark-office",
            "/Applications/Minh Spark Office Copy.app/Contents/MacOS/minh-spark-office",
            "/tmp/Minh Spark Office.app/minh-spark-office",
            "/Users/a/dev/target/release/minh-spark-office",
            "minh-spark-office",
        ] {
            assert_eq!(rename_plan(Path::new(path)), None, "{path}");
        }
    }
}
