# What is this?

## Summary

This extension helps you use semicolons correctly in JavaScript and TypeScript. It uses ASTs to get a map of your code, and then will parse your code and figure out if the statement is supposed to have a semicolon, not supposed to have a semicolon, or is not a statement. If it is not supposed to have a semicolon, then it makes sure there are none at the end. If there is, it will tell you. If it is supposed to have a semicolon, it detects if there is a semicolon present. If there isn't, then it tells you. If there is, it makes sure there is not more than one (if there is, it'll tell you).

## Features

- Missing Semicolon: Detects semicolons that are missing from the end of a statement.
- Unnecessary Semicolon: Detects semicolons wrongly used at the end of control statements.
- Extra Semicolon: Detects if you have more than one semicolon at the end of a statement. This is included in Unnecessary Semicolon.

# How to Use

## Comments

### Ignore a statement

To ignore a statement, simply insert this comment above the line, like so:

```javascript
// force-semicolon: ignore
function("function without a semicolon")
```

This will ignore the statement directly below the comment.

**Tip**: Ignore statements have to be directly before the expression. For example:

```javascript
if (condition) return;
// force-semicolon: ignore
else console.log("test") /// An error will be shown here
```

Even with the `ignore` there, it will still give a Missing Semicolon error for `console.log("test")`. This is because the `force-semicolon: ignore` comment is actually ignoring the `else` part of the statement, since the `else` is recognized as its own statement in the parser. Because the `else` doesn't use semicolons, this cancels out the `force-semicolon: ignore` action.

To ignore the statement inside the `else`, you will need to put the `force-semicolon: ignore` directly before the expression. For example:

```javascript
if (condition) return;
else /* force-semicolon: ignore */ console.log("test")
```

This will successfully ignore `console.log("test")`.

### Ignore a file

To ignore a file, simply insert this comment anywhere in the file, like so:

```javascript
// force-semicolon: ignore-all
f("function without a semicolon")
f("another function without a semicolon")
```

This will ignore all semicolon errors in the entire file.

### Ignore a file (workspace)

You can ignore a file or folder per workspace by right-clicking in the Explorer and selecting `Ignore/Unignore Semicolon Issues For This File/Folder`. This will store the file in your workspace settings, and will ignore or unignore the file's semicolon issues.

You can also ignore directories. This will ignore all files in the directory, including in subdirectories. However, you can choose to unignore files/directories *inside* a directory. This will override the higher directory. You can also do this for subdirectories, like so:

```js
- parentDir1       // ignored
    - parentDir2   // unignored (explicitly)
        - file1.ts // analyzed
    - file2.ts     // not analyzed
```

So here, you can ignore `parentDir1`, then unignore `parentDir2` explicitly. `file1.ts` will be analyzed, but `file2.ts` will be ignored.

## Settings

- `force-semicolon.missingSemicolonLintType`: setting that decides if VS Code should give an error, warning, or info dialogue for missing semicolons
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
        - Off: no line
    - Default: Error

- `force-semicolon.unnecessarySemicolonLintType`: setting that decides if VS Code should give an error, warning, or info dialogue for unnecessary semicolons (semicolons after function declarations, if statements, etc.)
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
        - Off: no line
    - Default: Error

- `force-semicolon.debugMode`: setting that enables/disabled debug mode. This enables action and report logs from this extension. **This is not recommended at all** since this floods the console with 1,000+ logs every single time you type, switch files, and save a file. It does that for each file when VS Code is opened, so it could output **20,000+** logs when started up. As you can imagine, this absolutely *decimates* performance and is highly **not** recommended to turn/keep on.
    - Default: off

## Commands

- Analyze All Files (`force-semicolon.analyze.all`): analyze all JavaScript and TypeScript files in the workspace (automatically called when the extension is loaded).
- Fix Missing Semicolons (Current File) (`force-semicolon.fix.current.missing`): fix all Missing Semicolon errors in the current file.
- Fix Unnecessary Semicolons (Current File) (`force-semicolon.fix.current.unnecessary`): fix all Unnecessary Semicolon errors in the current file.
- Fix All Semicolons (Current File) (`force-semicolon.fix.current.all`): fix all semicolon errors (Missing Semicolon, Unnecessary Semicolon) in the current file.
- Fix Missing Semicolons (All Open Files) (`force-semicolon.fix.open.missing`): fix all Missing Semicolon errors in all files that are open in the workspace (even if not actively selected).
- Fix Unnecessary Semicolons (All Open Files) (`force-semicolon.fix.open.unnecessary`): fix all Unnecessary Semicolon errors in all files that are open in the workspace (even if not actively selected).
- Fix All Semicolons (All Open Files) (`force-semicolon.fix.open.all`): fix all semicolon errors (Missing Semicolon, Unnecessary Semicolon) in all files that are open in the workspace (even if not actively selected).
- Fix Missing Semicolons (All Files) (`force-semicolon.fix.all.missing`): fix all Missing Semicolon errors in all files in the current workspace.
- Fix Unnecessary Semicolons (All Files) (`force-semicolon.fix.all.unnecessary`): fix all Unnecessary Semicolon errors in all files in the current workspace.
- Fix All Semicolons (All Files) (`force-semicolon.fix.all.all`): fix all semicolon errors (Missing Semicolon, Unnecessary Semicolon) in all files in the current workspace.

# Changelog

## 0.0.0 - 2/1/25

- Initial beta.

## 0.1.0 - 2/1/25

- Implemented `ignore` and `ignore-all` (see description).
- Fixed a bug that prevented the extension from finding errors.
- Other documentation updates.

## 0.1.1 - 2/1/25

- Fixed a bug that also scans JSON files.
- Fixed several semicolon detection bugs that gave false positives.

## 0.1.2 - 2/1/25

- Fixed a few more semicolon detection bugs.

## 0.2.0 - 2/1/25

- Added a new setting: force-semicolon.lintType for deciding if VS Code should give an error, warning, or info dialogue (default is error).
- ignore and ignore-all quick fixes.

## 0.2.1 - 2/1/25

- Fixed a bug affecting `.property()` lines of code.

## 0.2.2 - 2/1/25

- Bug fix affecting chained promises.
- Updated documentation.

## 0.2.3 - 2/2/25

- Bug fix affecting lines ending in `[`..
- Bug fix affecting multiline comments

## 0.3.0 - 2/5/25

- Complete overhaul of verification system. We switched over from pattern-based scanning to AST-based scanning. This not only improves accuracy, it allows the extension to scan single-line files and accurately find incorrect/missing semicolons.
- New feature: Unnecessary Semicolon: detects and warns you if you put a semicolon after a control statement (like a psychopath).
- You can also now turn off Missing Semicolon and Unnecessary Semicolon in VS Code settings.

## 0.3.1 - 2/5/25

- Bug fix affecting callbacks.
- Improved documentation.

## 0.3.2 - 2/5/25

- Bug fix affecting callbacks.

## 0.3.3 - 2/5/25

- Bug fix affecting callbacks. (third in a row, that is impressive)
- Improved documentation.
- Optimized extension.

## 0.3.4 - 2/5/25

- Improved documentation.

## 0.3.5 - 2/12/25

- Added commands to fix files.
- Fixed bug affecting exports.
- Fixed a bug affecting single-line control statements.

## 1.0.0 - 3/16/25

- Added detection for TypeScript interfaces.
- Added detection for functions in objects or arrays (also called object properties).
- Improved documentation.
- Exited beta.

## 1.0.1 - 11/14/25

- Fix Typescript class exports getting flagged by oth needing a semicolon and not needing a semicolon.
- Made the code actually semi-readable.

## 1.0.2 - 12/22/25

- Transition to a more systematic approach, so now false positives should be lessened.
- "Extra semicolon" is now merged into "unnecessary semicolon".

# Is this perfect?

No! You're likely to find several problems with my extension. Any contribution (or even just pointing out issues) is greatly appreciated!

# Known issues

- HTML is currently not supported.
- String literals may not be flagged.

# Support

For feedback and support, join my [Discord server](https://discord.gg/gbZyPuqZ6n).