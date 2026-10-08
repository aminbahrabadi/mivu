#!/usr/bin/env python3
"""Capture only the isolated native-test display for diagnosing GTK failures."""
import os
import sys
os.environ["GDK_BACKEND"] = "x11"
import gi

gi.require_version('Gdk', '3.0')
from gi.repository import Gdk

window = Gdk.get_default_root_window()
assert window is not None
image = Gdk.pixbuf_get_from_window(window, 0, 0, window.get_width(), window.get_height())
assert image is not None
image.savev(sys.argv[1], 'png', [], [])
