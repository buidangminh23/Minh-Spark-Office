use std::fs;
use std::io::ErrorKind;
use std::os::windows::io::AsRawHandle;
use std::path::PathBuf;
use std::process::Child;
use std::time::{SystemTime, UNIX_EPOCH};
use windows::Win32::Foundation::{CloseHandle, HANDLE};
use windows::Win32::System::JobObjects::{
    AssignProcessToJobObject, CreateJobObjectW, JobObjectExtendedLimitInformation,
    SetInformationJobObject, JOBOBJECT_EXTENDED_LIMIT_INFORMATION,
    JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
};

pub(crate) struct Workspace(pub(crate) PathBuf);

impl Workspace {
    pub(crate) fn create(prefix: &str) -> std::io::Result<Self> {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        for attempt in 0..16 {
            let dir = std::env::temp_dir()
                .join(format!("{prefix}-{}-{stamp}-{attempt}", std::process::id()));
            match fs::create_dir(&dir) {
                Ok(()) => return Ok(Self(dir)),
                Err(e) if e.kind() == ErrorKind::AlreadyExists => continue,
                Err(e) => return Err(e),
            }
        }
        Err(std::io::Error::from(ErrorKind::AlreadyExists))
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

pub(crate) struct Job(HANDLE);

impl Job {
    pub(crate) fn create() -> windows::core::Result<Self> {
        unsafe {
            let job = Self(CreateJobObjectW(None, None)?);
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            SetInformationJobObject(
                job.0,
                JobObjectExtendedLimitInformation,
                (&info as *const JOBOBJECT_EXTENDED_LIMIT_INFORMATION).cast(),
                std::mem::size_of_val(&info) as u32,
            )?;
            Ok(job)
        }
    }

    pub(crate) fn attach(&self, child: &Child) -> windows::core::Result<()> {
        unsafe { AssignProcessToJobObject(self.0, HANDLE(child.as_raw_handle())) }
    }
}

impl Drop for Job {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseHandle(self.0);
        }
    }
}
