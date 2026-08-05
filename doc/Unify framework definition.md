# Unify framework definition

I want to define all layout by a single json file. So that I can defien a new app by just using the ts framework + a json file.

If any format better than json is also ok.

For example:

```python
{
    'menu':{
        'file':{
            'new file',
        }
    },
    'docker':{
        'file':{
            'display_name': "explore",
            "icon": {"type": "image", "url":"..."}, # or unicode char or other type
            "sections":[
                {
                    "name":"aaa",
                    "subsectoins":[
                        "123": {
                            "components":[
                                {
                                    "type": "textbox",
                                    "id": "xxx",
                                    ...
                                }
                            ]
                        }
                    ]
                },
            ]
        }
    },
    "status":{
        ...
    }
}
```

Frontend UI should be built by the framework according only to the json (or other format file) provided

---

**Status: implemented**

The UI is now fully defined by a single JSON file:

- Live definition: `src/layout/framework.layout.json` (loaded + validated by
  `src/layout/loadLayout.ts` at startup)
- Review copy: `doc/framework.layout.json`
- Schema reference: [layout.md](./layout.md)

Differences from the sketch above, by design:

- `docker` is an **array** of `{ id, displayName, icon, panel }` (arrays
  preserve ordering for the icon bar) instead of a map keyed by tag.
- `subSections` is an array with explicit `id` per sub-section; section
  objects carry `{ id, label, subSections }`.
- Component types are `text`, `input`, `button`, `tree`, `keyValueList`,
  `list` (the sketch's "textbox" is the `input` type).
- Icons accept a unicode char (`"📁"`) or `{ "type": "image", "url": ... }`.
- `menu` items support `accelerator`, `icon`, `action` ids, `separator`;
  the framework handles action ids.