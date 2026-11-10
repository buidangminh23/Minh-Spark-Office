use std::ffi::CStr;
use std::sync::atomic::{AtomicPtr, Ordering};
use std::sync::OnceLock;

use objc2::rc::Retained;
use objc2::runtime::{AnyClass, AnyObject, Bool, ClassBuilder, Sel};
use objc2::{class, msg_send, sel, MainThreadMarker};
use tauri::AppHandle;

static APPLICATION: OnceLock<AppHandle> = OnceLock::new();
static DELEGATE: AtomicPtr<AnyObject> = AtomicPtr::new(std::ptr::null_mut());

#[link(name = "Foundation", kind = "framework")]
extern "C" {
    static NSDefaultRunLoopMode: *const AnyObject;
}

#[link(name = "AppKit", kind = "framework")]
extern "C" {
    static NSModalPanelRunLoopMode: *const AnyObject;
}

extern "C-unwind" fn should_terminate(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
    if let Some(app) = APPLICATION.get() {
        if crate::close_guard::approved(app) {
            return 1;
        }
        match crate::close_guard::request_native(app) {
            Ok(()) => return 2,
            Err(error) => eprintln!("Unable to defer native application termination: {error}"),
        }
    }
    0
}

extern "C-unwind" fn complete_termination(_: &AnyObject, _: Sel, payload: *mut AnyObject) {
    let Some(app) = APPLICATION.get() else {
        return;
    };
    let Some(payload) = (unsafe { payload.as_ref() }) else {
        return;
    };
    let encoded: u64 = unsafe { msg_send![payload, unsignedLongLongValue] };
    let (request_id, saved) = decode_completion(encoded);
    match crate::close_guard::complete(app, request_id, saved) {
        Ok(Some(crate::close_guard::CloseCompletion::ReplyNative(saved))) => unsafe {
            let application: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![application, replyToApplicationShouldTerminate: Bool::new(saved)];
        },
        Ok(Some(crate::close_guard::CloseCompletion::Exit)) => app.exit(0),
        Ok(_) => {}
        Err(error) => eprintln!("Unable to finish application termination: {error}"),
    }
}

fn decode_completion(encoded: u64) -> (u32, bool) {
    ((encoded >> 1) as u32, encoded & 1 != 0)
}

unsafe fn schedule_completion(
    delegate: &AnyObject,
    thread: &AnyObject,
    request_id: u32,
    saved: bool,
) {
    let encoded = (u64::from(request_id) << 1) | u64::from(saved);
    let payload: Retained<AnyObject> =
        unsafe { msg_send![class!(NSNumber), numberWithUnsignedLongLong: encoded] };
    let modes = unsafe { [NSDefaultRunLoopMode, NSModalPanelRunLoopMode] };
    let modes: Retained<AnyObject> =
        unsafe { msg_send![class!(NSArray), arrayWithObjects: modes.as_ptr(), count: modes.len()] };
    let _: () = unsafe {
        msg_send![delegate,
            performSelector: sel!(officeCompleteTermination:),
            onThread: thread,
            withObject: &*payload,
            waitUntilDone: Bool::NO,
            modes: &*modes
        ]
    };
}

pub fn dispatch_completion(request_id: u32, saved: bool) -> Result<(), String> {
    let delegate = unsafe { DELEGATE.load(Ordering::Acquire).as_ref() }
        .ok_or("The native application termination delegate is unavailable")?;
    unsafe {
        let thread: Retained<AnyObject> = msg_send![class!(NSThread), mainThread];
        schedule_completion(delegate, &thread, request_id, saved);
    }
    Ok(())
}

fn build_delegate_class(superclass: &AnyClass, name: &CStr) -> Result<&'static AnyClass, String> {
    if superclass
        .instance_method(sel!(applicationShouldTerminate:))
        .is_some()
    {
        return Err("The application delegate already owns native termination policy".into());
    }
    let mut builder = ClassBuilder::new(name, superclass)
        .ok_or("Unable to allocate the native termination delegate class")?;
    unsafe {
        builder.add_method(
            sel!(applicationShouldTerminate:),
            should_terminate as extern "C-unwind" fn(_, _, _) -> _,
        );
        builder.add_method(
            sel!(officeCompleteTermination:),
            complete_termination as extern "C-unwind" fn(_, _, _),
        );
    }
    let subclass = builder.register();
    if subclass.superclass() != Some(superclass)
        || subclass.instance_size() != superclass.instance_size()
    {
        return Err("The native termination delegate has an incompatible layout".into());
    }
    Ok(subclass)
}

pub fn install(app: &AppHandle) -> Result<(), String> {
    let _main_thread = MainThreadMarker::new()
        .ok_or("The native termination guard must be installed on the main thread")?;
    unsafe {
        let application: *mut AnyObject = msg_send![class!(NSApplication), sharedApplication];
        let application = application
            .as_ref()
            .ok_or("The native application is unavailable")?;
        let delegate: Option<Retained<AnyObject>> = msg_send![application, delegate];
        let delegate = delegate.ok_or("The native application delegate is unavailable")?;
        let original_class = delegate.class();
        let guarded_class = build_delegate_class(original_class, c"OfficeTerminationDelegate")?;
        APPLICATION
            .set(app.clone())
            .map_err(|_| "The native termination guard is already installed")?;
        let replaced_class = AnyObject::set_class(&delegate, guarded_class);
        if replaced_class != original_class {
            return Err("The native application delegate changed during installation".into());
        }
        let _: () = msg_send![application, setDelegate: std::ptr::null::<AnyObject>()];
        let _: () = msg_send![application, setDelegate: &*delegate];
        let installed: *mut AnyObject = msg_send![application, delegate];
        let responds: Bool =
            msg_send![&*delegate, respondsToSelector: sel!(applicationShouldTerminate:)];
        if !std::ptr::eq(installed, &*delegate)
            || delegate.class() != guarded_class
            || !responds.as_bool()
        {
            return Err("The native termination guard could not be verified".into());
        }
        DELEGATE.store(Retained::into_raw(delegate), Ordering::Release);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicU64;

    static DELIVERED_COMPLETION: AtomicU64 = AtomicU64::new(u64::MAX);

    extern "C-unwind" fn record_completion(_: &AnyObject, _: Sel, payload: *mut AnyObject) {
        let value: u64 = unsafe { msg_send![payload, unsignedLongLongValue] };
        DELIVERED_COMPLETION.store(value, Ordering::Release);
    }

    #[test]
    fn deferred_completion_runs_in_modal_and_default_modes_without_tauri_dispatch() {
        objc2::rc::autoreleasepool(|_| unsafe {
            let mut builder =
                ClassBuilder::new(c"OfficeTerminationTestModalReceiver", class!(NSObject)).unwrap();
            builder.add_method(
                sel!(officeCompleteTermination:),
                record_completion as extern "C-unwind" fn(_, _, _),
            );
            let receiver: Retained<AnyObject> = msg_send![builder.register(), new];
            let run_loop: Retained<AnyObject> = msg_send![class!(NSRunLoop), currentRunLoop];
            let thread: Retained<AnyObject> = msg_send![class!(NSThread), currentThread];
            for (mode, saved) in [
                (NSModalPanelRunLoopMode, true),
                (NSDefaultRunLoopMode, false),
            ] {
                DELIVERED_COMPLETION.store(u64::MAX, Ordering::Release);
                schedule_completion(&receiver, &thread, u32::MAX, saved);
                assert_eq!(DELIVERED_COMPLETION.load(Ordering::Acquire), u64::MAX);
                let deadline: Retained<AnyObject> =
                    msg_send![class!(NSDate), dateWithTimeIntervalSinceNow: 1.0_f64];
                let _: Bool = msg_send![&*run_loop, runMode: mode, beforeDate: &*deadline];
                let delivered = DELIVERED_COMPLETION.load(Ordering::Acquire);
                assert_ne!(delivered, u64::MAX);
                assert_eq!(decode_completion(delivered), (u32::MAX, saved));
            }
        });
    }

    extern "C-unwind" fn inherited_callback(_: &AnyObject, _: Sel) -> usize {
        37
    }

    extern "C-unwind" fn existing_termination(_: &AnyObject, _: Sel, _: *mut AnyObject) -> usize {
        1
    }

    #[test]
    fn native_termination_is_cancelled_without_save_coordinator() {
        let guarded =
            build_delegate_class(class!(NSObject), c"OfficeTerminationTestMissingCoordinator")
                .unwrap();
        let object: Retained<AnyObject> = unsafe { msg_send![guarded, new] };
        let reply: usize = unsafe { msg_send![&*object, applicationShouldTerminate: &*object] };
        assert_eq!(reply, 0);
    }

    #[test]
    fn delegate_subclass_preserves_instance_layout_and_inherited_callbacks() {
        let mut builder =
            ClassBuilder::new(c"OfficeTerminationTestParent", class!(NSObject)).unwrap();
        builder.add_ivar::<usize>(c"officeMarker");
        unsafe {
            builder.add_method(
                sel!(officeInheritedCallback),
                inherited_callback as extern "C-unwind" fn(_, _) -> _,
            );
        }
        let original = builder.register();
        let guarded = build_delegate_class(original, c"OfficeTerminationTestChild").unwrap();
        let object: Retained<AnyObject> = unsafe { msg_send![original, new] };
        let marker = original.instance_variable(c"officeMarker").unwrap();
        unsafe {
            marker.load_ptr::<usize>(&object).write(91);
            assert_eq!(AnyObject::set_class(&object, guarded), original);
            assert_eq!(*marker.load::<usize>(&object), 91);
        }
        let result: usize = unsafe { msg_send![&*object, officeInheritedCallback] };
        assert_eq!(result, 37);
        assert_eq!(guarded.superclass(), Some(original));
        assert_eq!(guarded.instance_size(), original.instance_size());
    }

    #[test]
    fn existing_native_termination_policy_is_not_overwritten() {
        let mut builder =
            ClassBuilder::new(c"OfficeTerminationTestExisting", class!(NSObject)).unwrap();
        unsafe {
            builder.add_method(
                sel!(applicationShouldTerminate:),
                existing_termination as extern "C-unwind" fn(_, _, _) -> _,
            );
        }
        let existing = builder.register();
        assert!(build_delegate_class(existing, c"OfficeTerminationTestRejected").is_err());
        let object: Retained<AnyObject> = unsafe { msg_send![existing, new] };
        let reply: usize = unsafe { msg_send![&*object, applicationShouldTerminate: &*object] };
        assert_eq!(reply, 1);
    }
}
