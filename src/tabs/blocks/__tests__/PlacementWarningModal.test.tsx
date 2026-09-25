import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  PlacementWarningModal,
  PLACEMENT_WARNING_SUPPRESS_KEYS,
} from '../PlacementWarningModal';

describe('PlacementWarningModal Component', () => {
  it('renders null when isOpen is false', () => {
    const html = renderToString(
      <PlacementWarningModal
        isOpen={false}
        type="peripheral-master"
        widgetName="Battery"
        onDismiss={() => {}}
        onRemove={() => {}}
      />
    );
    expect(html).toBe('');
  });

  it('renders peripheral-master modal with expected warning title and copy', () => {
    const html = renderToString(
      <PlacementWarningModal
        isOpen={true}
        type="peripheral-master"
        widgetName="Battery"
        onDismiss={() => {}}
        onRemove={() => {}}
      />
    );
    expect(html).toContain('Just a heads up!');
    expect(html).toContain('Battery on the right side');
    expect(html).toContain('secondary half of a split keyboard');
    expect(html).toContain('Keep Widget');
    expect(html).toContain('Remove');
    expect(PLACEMENT_WARNING_SUPPRESS_KEYS['peripheral-master']).toBe(
      'scyan_suppress_peripheral_master_modal'
    );
  });

  it('renders idle-interactive modal with expected warning title and copy', () => {
    const html = renderToString(
      <PlacementWarningModal
        isOpen={true}
        type="idle-interactive"
        widgetName="Bongo Cat"
        onDismiss={() => {}}
        onRemove={() => {}}
      />
    );
    expect(html).toContain('Active widget on Idle screen');
    expect(html).toContain('Bongo Cat responds to input');
    expect(html).toContain('will not be visible during idle');
    expect(html).toContain('Keep Widget');
    expect(html).toContain('Remove');
    expect(PLACEMENT_WARNING_SUPPRESS_KEYS['idle-interactive']).toBe(
      'scyan_suppress_idle_interactive_modal'
    );
  });

  it('renders sync-animation modal with expected warning title and copy', () => {
    const html = renderToString(
      <PlacementWarningModal
        isOpen={true}
        type="sync-animation"
        widgetName="Loop Animation"
        onDismiss={() => {}}
        onRemove={() => {}}
      />
    );
    expect(html).toContain('Split-Synchronized Animation');
    expect(html).toContain('Loop Animation synchronized across halves');
    expect(html).toContain('turn on both battery switches around the same time');
    expect(html).toContain('Got it');
    expect(html).toContain('Remove');
    expect(PLACEMENT_WARNING_SUPPRESS_KEYS['sync-animation']).toBe(
      'scyan_suppress_sync_animation_modal'
    );
  });
});
