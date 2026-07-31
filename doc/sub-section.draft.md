# Sub sections

Sub section is a group of content under section.

Level showed below

```python
class Panel:
    sections: list[Section]

class Section:
    sub_sections: list[SubSections]

class SubSection:
    components: list[Component]

class Component:
    # Component is a base type
    # It can be, such as: text box, inputable text box, button, key value table, tree (like a file tree), list of content, ...
    pass
```

## Panel layout

```python
class Panel:
    class TitleBar: # On the top of a panel
        name # Display Name of the Panel, left align
        button # a `...` button to toggle visibility of each sub section in a active section.
    
    class SectionSelectionBar: # Below TitleBar, Showed if len(section_tabs) > 1
        section_tabs: list[Section] # Click to activate section

    class SubsectionBody: # Below SectionSelectionBar, take all lefted Panel area
        sub_sections: list[SubSections] # All subsections should be show inside this area
```

## Sub Section layout

```python
class SubSection:
    class TitleBar: # Click the title bar to toggle expand/collpase of the ComponentBody
        expand_indicator # An icon to indicate subsection expand/collapse state
        display_name
        utilities: list[Utilities] # Some minor utilities botton (if defined), such as button click to refresh components it hosted

    class ComponentBody: # The area to show all components belongs to this subseciton
        components: list[Component]
```

### Size of a sub section

```python
class SubSection: 
    width = panel.width

    class TitleBar: 
        height # predefined, fixed

    class ComponentBody: 
        is_height_variable:bool
        min_height # Ignore if is_height_variable=False
        height
        components: list[Component]
        
        @property
        def height_of_components(self):
            return sum(component.height in self.components)

        def set_height(self, height):
            if self.is_height_variable:
                # Height cannot go below min_height
                if self.min_height < height:
                    self.height = height
                else:
                    self.height = self.min_height
            else:
                # Cannot set height if it is not height variable
                # and it is always equal to height_of_components
                self.height = self.height_of_components

        @property
        def is_scrollable(self):
            if self.height_of_components > self.height:
                # content of ComponentBody overflowed
                return True # Make ComponentBody internal scrollable
            else:
                # if is_height_variable=True, self.height_of_components == self.height
                return False
```

### Resizing logic

```python

class SubSection:
    # Three states of a subsection
    is_visible: bool # toggled by button on the Panel.TitleBar
    is_expanded: bool # toggled by clicking SubSection.TitleBar
    is_height_variable: bool # predefined, no adhoc change

class SubsectionBody:
    sub_sections: list[SubSections]
    _resizeable_subsections: list[SubSections]
    _height # height of the SubsectionBody
    _unallocated_space # Free space left in SubsectionBody, can go below 0 when overflowed

    def on_some_event_rebuild_resizeable_subsections(self):
        # update self._resizeable_subsections for quick reference 
        # resizeable_subsection = is_visible & is_expanded & is_height_variable
        pass

    def check_need_for_scrolbar(self):
        # If overflowed
        if self._unallocated_space < 0: 
            self.enable_scolling()

    def on_change_in_unallocated_space(self):
        # Triggered on passive resizing, such as
        # State change in any subsections' is_visible, is_expanded state
        # Window resizing


        if self._unallocated_space.increased and self._unallocated_space > 0:
            # Try to give all free space to the 1st resizeable_subsections
            # The first resizeable_subsection will always try to take any free space to fill all 
            if len(self._resizeable_subsections):
                self._resizeable_subsections[0].increase_height(self._unallocated_space)
                self._unallocated_space = 0
            else:
                # If none do nothing
                pass
        
        if self._unallocated_space.decreased and self._unallocated_space < 0:
            for sub_section in self._resizeable_subsections:
                # Reduce sub_section.height accordiingly, but cannot go below sub_section.min_height
                # return remaining _unallocated_space
                self._unallocated_space = sub_section.reduce_height(self._unallocated_space)

                if self._unallocated_space == 0:
                    break


        self.check_need_for_scrolbar()


    def on_drag_to_relocate_space_among_subsections(self, drag_line):
        # This should be a realtime event as mouse moving
        # Below just an abstract showcase how the space should be allocated among resizeable_subsections.

        if len(self._resizeable_subsections)<=1:
            # Cannot drag to relocate space
            return

        subsections_above, subsections_below = self._resizeable_subsections.bisect(drag_line)

        if drag_line.move_up:
            space_to_reallocate = 0
            # Squeeze space from subsections_above
            for sb in reversed(subsections_above): 
                # For each sb in subsections_above (from bottom to top)
                space_to_reallocate = sb.decrese_height_until_min_height()

            # Give all sqeezed space to first sb in subsections_below
            subsections_below[0].increase_height(space_to_reallocate)

        else:
            space_to_reallocate = 0
            # Squeeze space from subsections_below
            for sb in subsections_below:
                # For each sb in subsections_above (from top to bottom)
                space_to_reallocate = sb.decrese_height_until_min_height()

            subsections_above[-1].increase_height(space_to_reallocate)


        assert self._unallocated_space.no_change
```
