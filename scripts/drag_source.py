#!/usr/bin/env python3
"""A real GTK drag source for the isolated native integration test."""
import sys
from pathlib import Path
import gi

gi.require_version('Gtk', '3.0')
gi.require_version('Gdk', '3.0')
from gi.repository import Gdk, Gtk

window = Gtk.Window(title='Mivu drag test')
window.set_default_size(200, 120)
window.move(1020, 30)
button = Gtk.Button(label='Drag Markdown')
button.drag_source_set(Gdk.ModifierType.BUTTON1_MASK,
                       [Gtk.TargetEntry.new('text/uri-list', 0, 0)], Gdk.DragAction.COPY)
button.connect('drag-data-get', lambda widget, context, selection, info, timestamp:
               selection.set_uris([Path(sys.argv[1]).resolve().as_uri()]))
window.add(button)
window.connect('destroy', Gtk.main_quit)
window.show_all()
Gtk.main()
