import * as vscode from 'vscode';
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import babel from '@babel/core';
import { NodePath } from '@babel/traverse';

var debug: boolean = process.env.DEBUG !== null;
var html: boolean = false;
var allowFileAction: boolean = false;
var version = "1.0.1";

var defaultSeverity = 'error';
var diagnosticSource = 'force-semicolon';
var noSemicolonMessage: string = "Missing or invalid semicolon.";
var unnecessarySemicolonMessage: string = 'Unnecessary semicolon.';
var allowedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html'];

var defaultReport: {[key: string]: any} = {"0": [], "-1": []};
var report: {[key: string]: any} = defaultReport;

const SEMICOLON_STATEMENTS = new Set([
    "ExpressionStatement",
    "VariableDeclaration",
    "ReturnStatement",
    "ThrowStatement",
    "BreakStatement",
    "ContinueStatement",
    "ImportDeclaration",
    "DebuggerStatement",
    "EmptyStatement",
    "StringLiteral",
]);

const BLOCK_STATEMENTS = new Set([
    "BlockStatement",
    "IfStatement",
    "ForStatement",
    "ForInStatement",
    "ForOfStatement",
    "WhileStatement",
    "DoWhileStatement",
    "SwitchStatement",
    "TryStatement",
    "FunctionDeclaration",
    "ClassDeclaration",
]);

const TS_NO_SEMICOLON = new Set([
    "TSInterfaceDeclaration",
    "TSModuleDeclaration",
    "TSEnumDeclaration",
]);

function classify(path: NodePath): number {
    const type = path.node.type;

    if (!path.isStatement()) return 0; // Not a statement
    if (TS_NO_SEMICOLON.has(type)) return 0; // Typescript-specific
    if (path.isEmptyStatement()) return 2; // Empty statement
    if (path.parentPath?.isClassBody() ?? false) return 0;

    if (type === "ExportNamedDeclaration" || type === "ExportDefaultDeclaration") {
        const d = path.node.declaration;
        if (!d) return 1;

        if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") {
            return 0; // Export function/class
        } else if (TS_NO_SEMICOLON.has(d.type)) {
            return 0; // Declaration is TypeScript-specific
        }

        return 1;
    }

    if (type === "ExpressionStatement" && 'directive' in path.node) return 0;

    if (SEMICOLON_STATEMENTS.has(type)) {
        if (type == "VariableDeclaration" && path.parentPath) {
            if (path.parentPath.isForStatement() || path.parentPath.isForInStatement() || path.parentPath.isForOfStatement()) {
                return 0; // Variable declaration in loop head
            }
        }

        return 1; // Requires a semicolon (aside from ASI)
    }

    if (BLOCK_STATEMENTS.has(type)) return 0; // Doesn't need a semicolon
    return 0; // Overflow, not a statement
}

function print(input: any, attachment?: any) {
    if (debug) console.log("force-semicolon: log: " + input, attachment ?? 0);
}

function output(input: any, attachment?: any) {
    console.log("force-semicolon: output: " + input, attachment ?? 0);
}

function warn(input: any, attachment?: any) {
    if (debug) console.warn("force-semicolon: warn: " + input, attachment ?? -1);
}

function printReport(file: string, report: any) {
    console.log("force-semicolon: report: report is ready (file: " + file + ")");
    Object.keys(report).slice(0, 100).forEach(key => console.log(key, report[key]));
}

function error(input: any, attachment?: any) {
    console.error("force-semicolon: error: " + input, attachment ?? -1);
}

function action(input: any, attachment?: any) {
    if (debug) console.log("force-semicolon: action: " + input, attachment ?? 0);
}

function extractText(document: vscode.TextDocument): string | null {
    var text = document.getText();

    if (document.languageId === 'html') {
        if (!html) return null;
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
    var diagnosticsList: Array<any> = [];
    var statements: Array<any> = [];
    var ast = parseAst(document);

    if (!ast) return {diagnostics: []};
    const comments = (ast.comments.map((comment: any) => comment.value)).join(' ');

    if (comments.includes('force-semicolon: ignore-all')) {
        addReport(-1, 'comment.action.ignore-all');

        return {
            diagnostics: [],
            comments: comments,
        };
    }

    traverse(ast, {
        enter(path: NodePath) {
            var detectedResult = 0;
            var node = path.node;

            if (!node.loc || !node.loc.end) {
                error("invalid node location: " + node.loc);
                return;
            }

            var comments = node.leadingComments ?? [];

            if (comments.length > 0) {
                const comment = comments[comments.length - 1];
                if (comment.value.includes('force-semicolon: ignore')) {
                    detectedResult = -1;
                }
            }

            if (detectedResult >= 0) {
                // 0 = no report, 1 = needs semicolon, 2 = doesn't use semicolon
                detectedResult = classify(path);

                var { line, column } = node.loc.end;
                var lineM = line - 1;
                var columnM = column - 1;
                var columnP = column + 1;

                if (lineM <= 0) lineM = 0;
                if (columnM <= 0) columnM = 0;

                const start = new vscode.Position(lineM, columnP);
                const end = new vscode.Position(lineM, columnM);

                statements.push({
                    mode: detectedResult,
                    type: node.type,
                    start: start,
                    end: end,
                    comments: comments,
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
            if (text.includes(';')) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                range,
                noSemicolonMessage,
            );

            diagnosticsList.push({diagnostic: diagnostic, mode: 1});
            addReport(i, 'statements.statement.diagnostic.add.1.0', {'text': text, 'range': range, 'mode': 1, "statement": statement});
        } else if (statement.mode === 2) {
            if (!text.includes(';')) {
                continue;
            }

            const diagnostic = new vscode.Diagnostic(
                range,
                unnecessarySemicolonMessage,
            );

            diagnosticsList.push({diagnostic: diagnostic, mode: 2});
            addReport(i, 'statements.statement.diagnostic.add.2.0', {'text': text, 'range': range, 'mode': 2, "statement": statement});
        }
    }

    return {
        diagnostics: diagnosticsList,
        comments: comments,
    };
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
	print('force-semicolon version ' + version + ' is active (debug: ' + debug + ')');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    const editor = vscode.window.activeTextEditor;
    context.subscriptions.push(diagnostics);

    if (editor) {
        action('extension.active');
        updateDiagnostics(editor.document, diagnostics);
        analyzeAll(diagnostics);
    }

    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor) updateDiagnostics(editor.document, diagnostics);
    });

    vscode.workspace.onDidOpenTextDocument((document) => {
        action('workspace.onDidOpenTextDocument');
        updateDiagnostics(document, diagnostics);
    });

    vscode.window.onDidChangeActiveTextEditor(editor => {
        action('window.onDidChangeActivateTextEditor');
        if (editor) updateDiagnostics(editor.document, diagnostics);
    });

    vscode.workspace.onDidCreateFiles((event) => {
        fileAction('workspace.onDidCreateFiles', diagnostics);
    });

    vscode.workspace.onDidRenameFiles((event) => {
        fileAction('workspace.onDidRenameFiles', diagnostics);
    });

    context.subscriptions.push(vscode.commands.registerCommand('force-semicolon.analyze.all', () => {
        action('command.activate.analyze.all');
        analyzeAll(diagnostics);
    }));

    const fixCommands = [
        "force-semicolon.fix.current.missing",
        "force-semicolon.fix.current.unnecessary",
        "force-semicolon.fix.current.all",
        "force-semicolon.fix.open.missing",
        "force-semicolon.fix.open.unnecessary",
        "force-semicolon.fix.open.all",
        "force-semicolon.fix.all.missing",
        "force-semicolon.fix.all.unnecessary",
        "force-semicolon.fix.all.all",
    ];

    fixCommands.forEach(command => {
        context.subscriptions.push(vscode.commands.registerCommand(command, async () => {
            action(`command.activate.${command}`);
            command = command.replaceAll('force-semicolon.fix.', '');

            const subcommands = command.split('.');
            const document = subcommands[0];
            const type = subcommands[1];
            const documents = await getAllDocuments(document);

            if (documents === null) {
                warn("command " + command + " stopped: documents was null");
                return;
            }

            documents.forEach(document => {
                if (type === "all") {
                    fixDocument(document, "missing-semicolon");
                    fixDocument(document, "unnecessary-semicolon");
                } else {
                    fixDocument(document, type + '-semicolon');
                }
            });
        }));
    });

    allowedLanguages.forEach((language: string) => {
        vscode.languages.registerCodeActionsProvider(
            {language: language, scheme: 'file'},
            new SemicolonCodeActionProvider(),
        );
    });
}

async function getAllDocuments(type: 'current' | 'open' | 'all' | string): Promise<Array<vscode.TextDocument> | null> {
    switch (type) {
        case 'current':
            return vscode.window.activeTextEditor ? [vscode.window.activeTextEditor.document] : null;
        case 'open':
            return vscode.window.tabGroups.all.flatMap(({ tabs }) => tabs.map(tab => {
                let uri;

                if (tab.input instanceof vscode.TabInputText || tab.input instanceof vscode.TabInputNotebook) {
                    uri = tab.input.uri;
                } else if (tab.input instanceof vscode.TabInputTextDiff || tab.input instanceof vscode.TabInputNotebookDiff) {
                    uri = tab.input.original;
                }

                if (uri) {
                    const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
                    if (document) {
                        return document;
                    }
                }
                return null;
            })).filter(Boolean).filter(item => item !== null);
        case 'all':
            const files = await vscode.workspace.findFiles('**/*');
            const documentPromises = files.map(file => vscode.workspace.openTextDocument(file));
            const documents = await Promise.all(documentPromises);
            return documents;
        default:
            error("invalid document type: " + type);
            return null;
    }
}

function fileAction(name: string, diagnostics: vscode.DiagnosticCollection) {
    action(name + " (fileAction: " + allowFileAction + ")");
    if (allowFileAction) analyzeAll(diagnostics);
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

function addReport(index: number, type: string, input?: string | object) {
    if (!debug) {
        return;
    }

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
    if (!allowedLanguages.includes(document.languageId)) return;
    report = defaultReport;

    report["i"] = {
        "document": document.uri.fsPath,
        "language": document.languageId,
        "mode": 2,
    };

    var config = vscode.workspace.getConfiguration('force-semicolon');
    var diagnosticsList: vscode.Diagnostic[] = [];
    var ignoreAll: boolean = false;
    var missingSeverity: string = config.get<string>('missingSemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var unnecessarySeverity: string = config.get<string>('unnecessarySemicolonLintType', defaultSeverity) ?? defaultSeverity;

    const result: Record<string, any> = handle(-1, "", document);
    diagnosticsList = result.diagnostics;
    var diagnosticsS: Array<vscode.Diagnostic> = [];

    diagnosticsList.forEach((item: any, index: number) => {
        var detectedResult = 0;
        var diagnostic: vscode.Diagnostic = item.diagnostic;
        var off = 'Off';
        var code = 'unknown';

        if (item.mode === 1) {
            detectedResult = 1;
        } else if (item.mode === 2) {
            detectedResult = 2;
        } else if (item.mode === 3) {
            detectedResult = 3;
        } else {
            error("unknown diagnostic.mode: " + item.mode);
            detectedResult = 0;
        }

        switch (detectedResult) {
            case 0:
                diagnostic.severity = getSeverity(defaultSeverity)!;
                break;
            case 1:
                if (missingSeverity === off) detectedResult = -1;
                diagnostic.severity = getSeverity(missingSeverity)!;
                code = 'missing-semicolon';
                break;
            case 2:
                if (unnecessarySeverity === off) detectedResult = -1;
                diagnostic.severity = getSeverity(unnecessarySeverity)!;
                code = 'unnecessary-semicolon';
                break;
            default:
                error("unknown detectedResult: " + detectedResult);
                detectedResult = -1;
        }

        if (detectedResult >= 0) {
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

    if (config.get<boolean>('debugMode', false) ?? false) {
        printReport(document.uri.fsPath, report);
    }
}

async function fixDocument(document: vscode.TextDocument, type: string) {
    const name = document.fileName;
    print("fix document (" + name + "): start: on type " + type);

    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    print(JSON.stringify(diagnostics));
    const relevantDiagnostics = diagnostics.filter(d => d.code === type);
    print(JSON.stringify(relevantDiagnostics));

    if (relevantDiagnostics.length === 0) {
        print("fix document (" + name + "): stop: not enough diagnostics");
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    relevantDiagnostics.forEach(diagnostic => {
        print("fix document (" + name + "): fix: " + type);

        switch (diagnostic.code) {
            case "missing-semicolon":
                const positionS = new vscode.Position(diagnostic.range.end.line, diagnostic.range.end.character);
                edit.insert(document.uri, positionS, ';');
                print("fix document (" + name + "): success: fix missing-semicolon");
                break;

            case "unnecessary-semicolon":
                const positionA = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                const positionB = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2);
                const range = new vscode.Range(positionA, positionB);
                edit.delete(document.uri, range);
                print("fix document (" + name + "): success: fix unnecessary-semicolon");
                break;

            default:
                error("unknown diagnostic type: " + type);
                return;
        }
    });

    print("fix document (" + name + "): success: complete");
    await vscode.workspace.applyEdit(edit);
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
                    const removeFixU = new vscode.CodeAction(
                        'Remove unnecessary semicolon',
                        vscode.CodeActionKind.QuickFix,
                    );

                    const startOffset = document.offsetAt(diagnostic.range.start);
                    const endOffset = document.offsetAt(diagnostic.range.end);
                    const text = document.getText(diagnostic.range);

                    const range = text.trim() == ';' ? new vscode.Range(
                        document.positionAt(startOffset),
                        document.positionAt(startOffset + 1),
                    ) : new vscode.Range(
                        document.positionAt(endOffset - 1),
                        document.positionAt(endOffset),
                    );

                    removeFixU.edit = new vscode.WorkspaceEdit();
                    removeFixU.edit.delete(document.uri, range);
                    removeFixU.diagnostics = [diagnostic];
                    fixes.push(removeFixU);
                    break;

                default:
                    break;
            }
        });

        // Initialize fixes
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

        const pos = new vscode.Position(range.start.line, 0);
        ignoreFix.edit = new vscode.WorkspaceEdit();
        ignoreFix.edit.insert(document.uri, pos, ' '.repeat(spaces) + '// force-semicolon: ignore\n');
        fixes.push(ignoreFix);

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
    action('extension.deactivate');
}
