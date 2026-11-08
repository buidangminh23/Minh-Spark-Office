import { FeatureMenu } from '../../../../components/FeatureMenu';
import { useDocFeatures } from './useDocFeatures';

export function DocFeatureMenu() {
  return <FeatureMenu items={useDocFeatures()} className="ribbon-btn-large" />;
}
