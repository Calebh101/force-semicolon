import * as vscode from 'vscode';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

var mode: number = 2;
var debug: boolean = false;
var html: boolean = false;
var allowFileAction: boolean = false;
var useRegex: boolean = false;

var defaultSeverity = 'error';
var diagnosticSource = 'force-semicolon';
var noSemicolonMessage: string = "Missing or invalid semicolon.";
var unnecessarySemicolonMessage: string = 'Unnecessary semicolon.';
var extraSemicolonMessage: string = 'Extra semicolon.';

var regex: RegExp = /^(?!\..*)(?!.*[\{\}\(\):,/*]).*[^;]$/;
var defaultReport = {"0": [], "-1": []};
var report: { [key: string]: any } = defaultReport;

function print(input: any, attachment?: any) {
    if (debug) {
        console.log("force-semicolon: " + input, attachment ?? 0);
    }
}

function warn(input: any, attachment?: any) {
    if (debug) {
        console.warn("force-semicolon: " + input, attachment ?? -1);
    }
}

function printReport(file: string, report: any) {
    print("force-semicolon: report is ready (file: " + file + ")", report);
}

function error(input: any, attachment?: any) {
    console.error("force-semicolon: " + input, attachment ?? -1);
}

function extractText(document: vscode.TextDocument): string | null {
    var text = document.getText();
    if (document.languageId === 'html') {
        if (!html) {
            return null;
        }
        var htmlS = text;
        var jsRegex = /<script.*?>([\s\S]*?)<\/script>/g;
        var matches;
        text = '// force-semicolon auto generated file\n';

        while ((matches = jsRegex.exec(htmlS)) !== null) {
            text += matches[1];
        }
    }
    return text;
}

function parseAst(document: vscode.TextDocument): any {
    try {
        const text = extractText(document);
        if (!text) {
            print("text was null: " + text);
            return null;
        }
        const ast = parse(text, {
            sourceType: "module",
            ranges: true,
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
            allowReturnOutsideFunction: true,
        });

        return ast;
    } catch (e) {
        warn("error with parsing: " + e);
        return null;
    }
}

function handle(index: number, text: string, document: vscode.TextDocument): object {
    if (mode === 1) {
        text = removeCommentsOutsideStrings(text).trim();
        var valid = validText(text, document, index);
        var parentheses = handleParentheses(document, index);
        var comments = handleUnclosedComments(document, index);
        var output: boolean = valid && parentheses && !comments;
        return { 
            result: output, 
            validText: valid, 
            parenthesis: parentheses,
            comments: comments 
        };
    } else if (mode === 2) {
        var diagnosticsList: Array<any> = [];
        var statements: Array<any> = [];
        var ast = parseAst(document);

        if (!ast) {
            return {diagnostics: []};
        }

        const comments = (ast.comments.map((comment: any) => comment.value)).join(' ');

        if (comments.includes('force-semicolon: ignore-all')) {
            addReport(-1, 'comment.action.ignore-all');
            return {
                diagnostics: [],
                comments: comments,
            };
        }
        
        traverse(ast, {
            enter(path: any) {
                var modeS = 0;
                var node = path.node;

                if (!node.loc || !node.loc.end) {
                    error("invalid node location: " + node.loc);
                    return;
                }

                var comments = node.leadingComments ?? [];
                if (comments.length > 0) {
                    const comment = comments[comments.length - 1];
                    if (comment.value.includes('force-semicolon: ignore')) {
                        modeS = -1;
                    }
                }

                if (modeS >= 0) {
                    var isExpressionStatement = path.isExpressionStatement();
                    var isVariableDeclaration = path.isVariableDeclaration();
                    var isReturnStatement = path.isReturnStatement();
                    var isIfStatement = path.isIfStatement();
                    var isForStatement = path.isForStatement();
                    var isWhileStatement = path.isWhileStatement();
                    var isDoWhileStatement = path.isDoWhileStatement();
                    var isSwitchStatement = path.isSwitchStatement();
                    var isFunctionDeclaration = path.isFunctionDeclaration();
                    var isFunctionExpression = path.isFunctionExpression();
                    var isArrowFunctionExpression = path.isArrowFunctionExpression();
                    var isTryStatement = path.isTryStatement();
                    var isThrowStatement = path.isThrowStatement();
                    var isImportDeclaration = path.isImportDeclaration();
                    var isExportDeclaration = path.isExportDeclaration();
                    var isClassDeclaration = path.isClassDeclaration();
                    var isClassMethod = path.isClassMethod();
                    var isExportNamedDeclaration = path.isExportNamedDeclaration();
                    var isExportDefaultDeclaration = path.isExportDefaultDeclaration();
                    var isCallExpression = path.isCallExpression();

                    var isInLoopHead = Boolean(path.findParent((parent: any) => isVariableDeclaration && (parent.isForStatement() || parent.isForOfStatement() || parent.isForInStatement()) && path.key === "left"));
                    var isInObjectProperty = Boolean(path.findParent((parent: any) => parent.isObjectProperty()));
                    var isAsyncFunctionExpression = isFunctionExpression && path.node.async;

                    var { line, column } = node.loc.end;
                    var lineM = line - 1;
                    var lineP = line - 1;
                    var columnM = column - 1;
                    var columnP = column + 1;

                    if (lineM <= 0) {
                        lineM = 0;
                    }

                    if (columnM <= 0) {
                        columnM = 0;
                    }

                    const start = new vscode.Position(lineM, columnP);
                    const end = new vscode.Position(lineM, columnM);

                    if ((isExpressionStatement || isVariableDeclaration || isReturnStatement || isFunctionExpression || isDoWhileStatement || isThrowStatement || isImportDeclaration || isExportDeclaration) && !(isVariableDeclaration && isInLoopHead) && !isArrowFunctionExpression && !isExportNamedDeclaration && !isExportDefaultDeclaration && !isCallExpression) {
                        modeS = 1;
                    } else if ((isIfStatement || isWhileStatement || isForStatement || isSwitchStatement || isDoWhileStatement || isFunctionDeclaration || isTryStatement || isClassDeclaration || isClassMethod) && !(isVariableDeclaration && isInLoopHead) && !isArrowFunctionExpression) {
                        modeS = 2;
                    } else {
                        modeS = 0;
                    }

                    statements.push({
                        mode: modeS,
                        type: node.type,
                        start: start,
                        end: end,
                        isExpressionStatement,
                        isVariableDeclaration,
                        isReturnStatement,
                        isIfStatement,
                        isForStatement,
                        isWhileStatement,
                        isDoWhileStatement,
                        isSwitchStatement,
                        isFunctionDeclaration,
                        isFunctionExpression,
                        isTryStatement,
                        isInLoopHead,
                        isInObjectProperty,
                        isThrowStatement,
                        isImportDeclaration,
                        isExportDeclaration,
                        isExportDefaultDeclaration,
                        isExportNamedDeclaration,
                        isClassDeclaration,
                        isClassMethod,
                        isAsyncFunctionExpression,
                        isCallExpression,
                    });
                }
            },
        });

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i];
            const start = statement.start;
            const end = statement.end;
            const range = new vscode.Range(start, end);
            const text = document.getText(range);

            if (statement.mode === 1) {
                if (text.includes(';;')) {
                    const diagnostic = new vscode.Diagnostic(
                        range,
                        extraSemicolonMessage,
                    );

                    diagnosticsList.push({diagnostic: diagnostic, mode: 3});
                    addReport(i, 'statements.statement.diagnostic.add.1.1', {'text': text, 'range': range, 'mode': 1});
                } else {
                    if (text.includes(';')) {
                        continue;
                    }

                    const diagnostic = new vscode.Diagnostic(
                        range,
                        noSemicolonMessage,
                    );

                    diagnosticsList.push({diagnostic: diagnostic, mode: 1});
                    addReport(i, 'statements.statement.diagnostic.add.1.0', {'text': text, 'range': range, 'mode': 1});
                }
            } else if (statement.mode === 2) {
                if (!text.includes(';')) {
                    continue;
                }

                const diagnostic = new vscode.Diagnostic(
                    range,
                    unnecessarySemicolonMessage,
                );

                diagnosticsList.push({diagnostic: diagnostic, mode: 2});
                addReport(i, 'statements.statement.diagnostic.add.2.0', {'text': text, 'range': range, 'mode': 2});
            }
        }

        return {
            diagnostics: diagnosticsList,
            comments: comments,
        };
    } else {
        throw new Error("handle: invalid mode: " + mode);
    }
}

function validText(input: string, document: vscode.TextDocument, index: number): boolean {
    const nextLine = getNextRelevantLine(document, index);
    if (input.endsWith(')') && nextLine && nextLine.trim().startsWith('.')) {
        return false;
    }

    if (useRegex) {
        return regex.test(input);
    } else {
        return !(input.endsWith('{') || input.endsWith('}') || input.endsWith('[') || input.endsWith('(') || input.endsWith(':') || input.endsWith(',') || input.endsWith('/*') || input.endsWith('*/')) && !(input.endsWith(';')) && !(input.startsWith('.'));
    }
}

function getNextRelevantLine(document: vscode.TextDocument, currentLine: number): string {
    for (let i = currentLine + 1; i < document.lineCount; i++) {
        let lineText = document.lineAt(i).text.trim();

        if (lineText.length > 0 && !lineText.startsWith('//')) {
            return lineText;
        }
    }
    return '';
}

function getSeverity(input: string): vscode.DiagnosticSeverity | null {
    switch (input) {
        case 'Info':
        case 'info': return vscode.DiagnosticSeverity.Information;

        case 'Hint':
        case 'hint': return vscode.DiagnosticSeverity.Hint;

        case 'Warning':
        case 'warn': return vscode.DiagnosticSeverity.Warning;

        case 'Error':
        case 'error': return vscode.DiagnosticSeverity.Error;

        case 'Off':
        case 'off': return null;

        default:
            error("unknown severity: " + input);
            return getSeverity(defaultSeverity);
    }
}

export function activate(context: vscode.ExtensionContext) {
	print('force-semicolon is active (debug: ' + debug + ')');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    const editor = vscode.window.activeTextEditor;

    if (editor) {
        print("action: extension.activate");
        updateDiagnostics(editor.document, diagnostics);
        analyzeAll(diagnostics);
    }

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        print("action: workspace.onDidOpenTextDocument");
        updateDiagnostics(document, diagnostics);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        print("action: window.onDidChangeActiveTextEditor");
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });

    vscode.workspace.onDidCreateFiles((event) => {
        fileAction('workspace.onDidCreateFiles', diagnostics);
    });

    vscode.workspace.onDidRenameFiles((event) => {
        fileAction('workspace.onDidRenameFiles', diagnostics);
    });

    let analyzeAllCommand = vscode.commands.registerCommand('force-semicolon.analyzeAll', () => {
        print("action: command.force-semicolon.analyzeAll");
        analyzeAll(diagnostics);
    });

    context.subscriptions.push(diagnostics);
    context.subscriptions.push(analyzeAllCommand);

    vscode.languages.registerCodeActionsProvider(
        { language: 'javascript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
    vscode.languages.registerCodeActionsProvider(
        { language: 'typescript', scheme: 'file' },
        new SemicolonCodeActionProvider()
    );
}

function fileAction(name: string, diagnostics: vscode.DiagnosticCollection) {
    print("action: " + name + " (fileAction: " + allowFileAction + ")");
    if (allowFileAction) {
        analyzeAll(diagnostics);
    }
}

function analyzeAll(diagnostics: vscode.DiagnosticCollection) {
    vscode.workspace.findFiles('**/*.{js,ts}', '**/node_modules/**').then(files => {
        files.forEach(fileUri => {
            vscode.workspace.openTextDocument(fileUri).then(document => {
                updateDiagnostics(document, diagnostics);
            });
        });
    });
}

function handleParentheses(document: vscode.TextDocument, lineIndex: number): boolean {
    let type = "rounded";
    let openParenthesesCount: number = 0;
    let encounter: number = 0;

    let open = '';
    let close = '';

    switch (type) {
        case 'rounded': 
            open = '(';
            close = ')';
            break;
        case 'curved':
            open = '{';
            close = '}';
            break;
        default:
            return handleParentheses(document, lineIndex);
    }

    let inString = false;
    let stringDelimiter = '';
    
    for (let i = 0; i <= lineIndex; i++) {
        const lineText = document.lineAt(i).text;
        encounter = 0;

        for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
            const char = lineText[charIndex];

            if ((char === '"' || char === "'") && (charIndex === 0 || lineText[charIndex - 1] !== '\\')) {
                if (!inString) {
                    inString = true;
                    stringDelimiter = char;
                } else if (char === stringDelimiter) {
                    inString = false;
                }
                continue;
            }

            if (!inString) {
                if (char === open) {
                    openParenthesesCount++;
                } else if (char === close) {
                    openParenthesesCount--;
                }

                if (type === "rounded" && char === '{') {
                    encounter++;
                }

                if (type === "rounded" && char === '}') {
                    encounter--;
                }
            }

            if (openParenthesesCount < 0) {
                return false;
            }
        }
    }

    let condition: boolean = openParenthesesCount === 0;
    let encountered: boolean = encounter > 0;

    if (encounter) {
        return true;
    } else {
        return condition;
    }
}

function handleUnclosedComments(document: vscode.TextDocument, lineIndex: number): boolean {
    let commentOpenCount = 0;

    for (let i = 0; i <= lineIndex; i++) {
        const lineText = document.lineAt(i).text;

        let startIndex = 0;
        while ((startIndex = lineText.indexOf('/*', startIndex)) !== -1) {
            commentOpenCount++;
            startIndex += 2;
        }

        let endIndex = 0;
        while ((endIndex = lineText.indexOf('*/', endIndex)) !== -1) {
            commentOpenCount--;
            endIndex += 2;
        }

        if (commentOpenCount < 0) {
            return false;
        }
    }

    return commentOpenCount > 0; // true if unclosed
}

function addReport(index: number, type: string, input?: string | object) {
    var generated = {
        "index": index,
        "type": type,
        "value": input,
    };

    if (index <= -1) {
        report[`${index}`].push(generated);
    } else {
        report[`${index}`] = generated;
    }
}

function updateDiagnostics(document: vscode.TextDocument, diagnostics: vscode.DiagnosticCollection) {
    if (document.languageId !== 'javascript' && document.languageId !== 'typescript' && document.languageId !== 'html') {
        return;
    }

    report = defaultReport;
    report["i"] = {
        "document": document.uri.fsPath,
        "language": document.languageId,
        "mode": mode,
    };

    var config = vscode.workspace.getConfiguration('force-semicolon');
    var diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;
    var missingSeverity: string = config.get<string>('missingSemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var unnecessarySeverity: string = config.get<string>('unnecessarySemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var extraSeverity: string = config.get<string>('extraSemicolonLintType', defaultSeverity) ?? defaultSeverity;

    if ((config.get<boolean>('debug', debug) ?? debug) === true) {
        debug = true;
    }

    if (mode === 1) {
        for (let i = 0; i < document.lineCount; i++) {
            var origLineText: string = document.lineAt(i).text;
            var lineText: string = origLineText.trim();

            if (lineText.length > 0) {
                if (lineText.startsWith('//')) {
                    if (lineText.includes("force-semicolon: ignore-all")) {
                        ignoreAll = true;
                        addReport(i, "comment.action", "general.all.ignore");
                    } else if (lineText.includes("force-semicolon: ignore")) {
                        i++;
                        addReport(i, "comment.action", "general.one.ignore");
                    } else {
                        addReport(i, "comment.generic");
                    }
                } else {
                    const result: Record<string, any> = handle(i, lineText, document);
                    addReport(i, (result.result ? "line.scan.success" : (("error" in result) ? "line.scan.error" : "line.scan.fail")), result);
                    if (result.result) {
                        const lineLength = origLineText.length;
                        const lastCharPosition = new vscode.Position(i, lineLength - 1);
                        const range = new vscode.Range(lastCharPosition, lastCharPosition);

                        const diagnostic = new vscode.Diagnostic(
                            range,
                            noSemicolonMessage,
                        );
                        diagnosticsList.push(diagnostic);
                    } else {
                        if ("error" in result) {
                            error(result.error);
                            return;
                        }
                    }
                }
            }
        }
    } else if (mode === 2) {
        const result: Record<string, any> = handle(-1, "", document);
        diagnosticsList = result.diagnostics;
    }

    var diagnosticsS: Array<vscode.Diagnostic> = [];

    diagnosticsList.forEach((item: any, index: number) => {
        var modeS = 9;
        var diagnostic: vscode.Diagnostic = item.diagnostic;
        var off = 'Off';
        var code = 'unknown';

        if (mode === 1) {
            modeS = 1;
        } else if (mode === 2) {
            if (item.mode === 1) {
                modeS = 1;
            } else if (item.mode === 2) {
                modeS = 2;
            } else if (item.mode === 3) {
                modeS = 3;
            } else {
                error("unknown diagnostic.mode: " + item.mode);
                modeS = 0;
            }
        } else {
            error("unknown mode: " + mode);
            modeS = 0;
        }

        switch (modeS) {
            case 0:
                diagnostic.severity = getSeverity(defaultSeverity)!;
                break;
            case 1:
                if (missingSeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(missingSeverity)!;
                code = 'missing-semicolon';
                break;
            case 2:
                if (unnecessarySeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(unnecessarySeverity)!;
                code = 'unnecessary-semicolon';
                break;
            case 3:
                if (extraSeverity === off) {
                    modeS = -1;
                }
                diagnostic.severity = getSeverity(extraSeverity)!;
                code = 'extra-semicolon';
                break;
            default:
                error("unknown modeS: " + modeS);
                modeS = -1;
        }

        if (modeS >= 0) {
            diagnostic.code = code;
            diagnostic.source = diagnosticSource; 
            diagnosticsS.push(diagnostic);
        }
    });

    if (ignoreAll) {
        addReport(-1, 'diagnostics.set', 'ignore');
        diagnostics.set(document.uri, []);
    } else {
        addReport(-1, 'diagnostics.set', 'set');
        diagnostics.set(document.uri, diagnosticsS);
    }

    printReport(document.uri.fsPath, report);
}

function removeCommentsOutsideStrings(line: string): string {
    let inString = false;
    let inTemplate = false;
    let result = "";
    let i = 0;

    while (i < line.length) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && !inTemplate) {
            inString = !inString;
        } else if (char === "'" && !inTemplate) {
            inString = !inString;
        } else if (char === '`' && !inString) {
            inTemplate = !inTemplate;
        }

        if (char === '/' && (nextChar === '/' || nextChar === '*') && !inString && !inTemplate) {
            return result;
        }

        result += char;
        i++;
    }

    return result;
}

class SemicolonCodeActionProvider implements vscode.CodeActionProvider {
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken,
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const diagnostics = context.diagnostics.filter(d => d.source === diagnosticSource);
        var fixes: Array<any> = [];
        if (diagnostics.length === 0) {
            return [];
        }

        diagnostics.forEach(diagnostic => {
            switch (diagnostic.code) {
                case "missing-semicolon":
                    // addFix
                    const addFix = new vscode.CodeAction(
                        'Add semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const position = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    addFix.edit = new vscode.WorkspaceEdit();
                    addFix.edit.insert(document.uri, position, ';');
                    addFix.diagnostics = [diagnostic];
                    fixes.push(addFix);
                    break;

                case "unnecessary-semicolon":
                    // removeFix
                    const removeFixU = new vscode.CodeAction(
                        'Remove unnecessary semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const positionA = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const range = new vscode.Range(
                        positionA,
                        new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2),
                    );

                    removeFixU.edit = new vscode.WorkspaceEdit();
                    removeFixU.edit.delete(document.uri, range);
                    removeFixU.diagnostics = [diagnostic];
                    fixes.push(removeFixU);
                    break;

                case "extra-semicolon":
                    // removeFix
                    const removeFixE = new vscode.CodeAction(
                        'Remove extra semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );
        
                    const positionB = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const rangeE = new vscode.Range(
                        positionB,
                        new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2),
                    );

                    removeFixE.edit = new vscode.WorkspaceEdit();
                    removeFixE.edit.delete(document.uri, rangeE);
                    removeFixE.diagnostics = [diagnostic];
                    fixes.push(removeFixE);
                    break;
                
                default:
                    break;
            }
        });

        // initialize fixes
        const ignoreFix = new vscode.CodeAction(
            'Ignore this line',
            vscode.CodeActionKind.QuickFix,
        );

        const ignoreAllFix = new vscode.CodeAction(
            'Ignore this file',
            vscode.CodeActionKind.QuickFix,
        );

        const lineText = document.lineAt(range.start.line).text;
        const trimmedText = lineText.trimEnd();
        const spaces = getLeadingSpaces(lineText);

        if (trimmedText.length <= 0) {
            return [];
        }

        // ignoreFix
        const pos = new vscode.Position(range.start.line, 0);
        ignoreFix.edit = new vscode.WorkspaceEdit();
        ignoreFix.edit.insert(document.uri, pos, ' '.repeat(spaces) + '// force-semicolon: ignore\n');
        fixes.push(ignoreFix);

        // ignoreAllFix
        const posA = new vscode.Position(0, 0);
        ignoreAllFix.edit = new vscode.WorkspaceEdit();
        ignoreAllFix.edit.insert(document.uri, posA, '// force-semicolon: ignore-all\n');
        fixes.push(ignoreAllFix);

        return fixes;
    }
}

function getLeadingSpaces(lineText: string): number {
    const match = lineText.match(/^(\s*)/);
    return match ? match[0].length : 0;
}

export function deactivate() {
    print("deactivating...");
}
