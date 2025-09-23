# Keyboard Shortcuts Reference

This document lists all available keyboard shortcuts for the application.

## Window Movement
| Shortcut | Action |
|----------|--------|
| `Cmd+←` | Move window left |
| `Cmd+→` | Move window right |
| `Cmd+↑` | Move window up |
| `Cmd+↓` | Move window down |

## Window Resizing
| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+=` | Make window larger (both width and height) |
| `Cmd+Shift+-` | Make window smaller (both width and height) |
| `Cmd+Shift+]` | Increase window width |
| `Cmd+Shift+[` | Decrease window width |
| `Cmd+Shift+↑` | Increase window height |
| `Cmd+Shift+↓` | Decrease window height |
| `Cmd+Shift+0` | Toggle window size (800×200 ⇄ 800×800) |

## Screen Capture
| Shortcut | Action |
|----------|--------|
| `Cmd+A` | Capture behind overlay region |

## Window Control
| Shortcut | Action |
|----------|--------|
| `Cmd+B` | Toggle window visibility (show/hide) |

## Audio Control
| Shortcut | Action |
|----------|--------|
| `Cmd+R` | Start audio recording |
| `Cmd+T` | Stop audio recording |

## Session Management
| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+R` | Reset session history |
| `Cmd+Shift+F` | Toggle OCR filtering on/off |
| `Cmd+Shift+P` | Switch AI provider (Ollama ↔ HuggingFace) |
| `Cmd+Shift+W` | Manual model warmup (Ollama only) |

## Help
| Shortcut | Action |
|----------|--------|
| `Cmd+Shift+H` | Display all shortcuts in console |

## Notes

- **Resize Step**: Each resize operation changes the dimension by 50 pixels
- **Move Step**: Each move operation shifts the window by 20 pixels  
- **Minimum Size**: Window cannot be resized smaller than 200×200 pixels
- **Default Size**: The default window size is 800×800 pixels
- **Feedback**: All resize operations display the new dimensions in the console
- **Platform**: These shortcuts are designed for macOS (`Cmd` key). On other platforms, replace `Cmd` with `Ctrl`

## Usage Tips

1. Use `Cmd+Shift+H` to quickly display all shortcuts in the console
2. Combine movement and resizing shortcuts to precisely position and size your window
3. Use `Cmd+Shift+0` to toggle between small (800×200) and default (800×800) window sizes
4. The window maintains a minimum size to ensure usability