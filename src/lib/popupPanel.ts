import type { PanelComponent, PanelH1, PanelH2, PanelH3 } from '../types/panel';
import type { PopupDocument, PopupH2, PopupValues } from '../types/popup';

export interface PopupH1Group {
  id: string;
  title: string;
  h2s: PopupH2[];
}

export function popupH1Groups(doc: PopupDocument): PopupH1Group[] {
  if (!doc.h1 || doc.h1.length === 0) {
    throw new Error('popup document must define h1 sections');
  }
  return doc.h1.map((h1) => ({ id: h1.id, title: h1.title, h2s: h1.h2 }));
}

export function popupH2PanelId(groupId: string, h2: PopupH2, index: number): string {
  return h2.title ? `${groupId}::${h2.title}` : `${groupId}::${index}`;
}

export function toPanelH1(group: PopupH1Group, values: PopupValues): PanelH1 {
  const h2: PanelH2[] = group.h2s.map((h2, i) => {
    if (!h2.title) {
      throw new Error(`popup h2 section ${i} of '${group.id}' must define a title`);
    }
    const components: (PanelComponent | PanelH3)[] = [
      {
        type: 'form',
        fields: h2.fields,
        values,
        extraSlot: h2.extraSlot,
      },
    ];
    for (const h3 of h2.h3 ?? []) {
      components.push({
        id: `${popupH2PanelId(group.id, h2, i)}::${h3.title}`,
        title: h3.title,
        heading: 3,
        components: [
          {
            type: 'form',
            fields: h3.fields,
            values,
          },
        ],
      });
    }
    return {
      id: popupH2PanelId(group.id, h2, i),
      title: h2.title ?? '',
      heading: 2,
      isHeightVariable: false,
      components,
    };
  });
  return { id: group.id, title: group.title, h2 };
}
