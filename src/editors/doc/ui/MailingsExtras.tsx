import type { DialogId } from '../DocContext';
import { EmailMergeDialog, EnvelopesDialog, LabelsDialog, MergeWizardDialog } from './MailDialogs';
import { AddressBlockDialog, CheckErrorsDialog, FindRecipientDialog, GreetingDialog, MatchFieldsDialog, RecipientsDialog, RuleDialog } from './MergeDialogs';

export default function MailingsExtras({ dialog, onClose }: { dialog: DialogId | null; onClose: () => void }) {
  switch (dialog) {
    case 'envelopes': return <EnvelopesDialog onClose={onClose} />;
    case 'labels': return <LabelsDialog onClose={onClose} />;
    case 'mergeemail': return <EmailMergeDialog onClose={onClose} />;
    case 'mergewizard': return <MergeWizardDialog onClose={onClose} />;
    case 'mergerecipients': return <RecipientsDialog onClose={onClose} />;
    case 'mergematch': return <MatchFieldsDialog onClose={onClose} />;
    case 'mergeaddress': return <AddressBlockDialog onClose={onClose} />;
    case 'mergegreeting': return <GreetingDialog onClose={onClose} />;
    case 'mergerule': return <RuleDialog onClose={onClose} />;
    case 'mergefind': return <FindRecipientDialog onClose={onClose} />;
    case 'mergecheck': return <CheckErrorsDialog onClose={onClose} />;
    default: return null;
  }
}
