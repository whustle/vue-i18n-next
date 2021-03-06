import {
  ResourceNode,
  Node,
  NodeTypes,
  PluralNode,
  MessageNode,
  TextNode,
  ListNode,
  NamedNode,
  LinkedNode,
  LinkedKeyNode,
  LinkedModitierNode,
  LiteralNode
} from './parser'
import { CodeGenOptions } from './options'
import { HelperNameMap } from './runtime'
import { isString } from '../utils'

type CodeGenContext = {
  source?: string
  code: string
  indentLevel: number
  // line: number
  // column: number
  // offset: number
  // map?: SourceMapGenerator
}

type CodeGenerator = {
  context(): CodeGenContext
  push(code: string): void
  indent(): void
  deindent(withoutNewLine?: boolean): void
  newline(): void
  helper(key: string): string
}

function createCodeGenerator(source?: string): CodeGenerator {
  const _context = {
    source,
    code: '',
    indentLevel: 0
  } as CodeGenContext

  const context = (): CodeGenContext => _context

  function push(code: string): void {
    _context.code += code
  }

  function _newline(n: number): void {
    push('\n' + `  `.repeat(n))
  }

  function indent(): void {
    _newline(++_context.indentLevel)
  }

  function deindent(withoutNewLine?: boolean): void {
    if (withoutNewLine) {
      --_context.indentLevel
    } else {
      _newline(--_context.indentLevel)
    }
  }

  function newline(): void {
    _newline(_context.indentLevel)
  }

  const helper = (key: string): string => `_${key}`

  return {
    context,
    push,
    indent,
    deindent,
    newline,
    helper
  }
}

function generateLinkedNode(generator: CodeGenerator, node: LinkedNode): void {
  const { helper } = generator
  if (node.modifier) {
    generator.push(`${helper(HelperNameMap.MODIFIER)}(`)
    generateNode(generator, node.modifier)
    generator.push(')(')
  }
  generator.push(`${helper(HelperNameMap.MESSAGE)}(`)
  generateNode(generator, node.key)
  generator.push(')(ctx)')
  if (node.modifier) {
    // TODO: should be refactorerd! (remove TYPE!)
    generator.push(`, ${helper(HelperNameMap.TYPE)})`)
  }
}

function generateMessageNode(
  generator: CodeGenerator,
  node: MessageNode
): void {
  const { helper } = generator
  generator.push(`${helper(HelperNameMap.NORMALIZE)}([`)
  generator.indent()
  const length = node.items.length
  for (let i = 0; i < length; i++) {
    generateNode(generator, node.items[i])
    if (i === length - 1) {
      break
    }
    generator.push(', ')
  }
  generator.deindent()
  generator.push('])')
}

function generatePluralNode(generator: CodeGenerator, node: PluralNode): void {
  const { helper } = generator
  if (node.cases.length > 1) {
    generator.push('[')
    generator.indent()
    const length = node.cases.length
    for (let i = 0; i < length; i++) {
      generateNode(generator, node.cases[i])
      if (i === length - 1) {
        break
      }
      generator.push(', ')
    }
    generator.deindent()
    generator.push(
      `][${helper(HelperNameMap.PLURAL_RULE)}(${helper(
        HelperNameMap.PLURAL_INDEX
      )}, ${length}, ${helper(HelperNameMap.ORG_PLURAL_RULE)})]`
    )
  }
}

function generateResource(generator: CodeGenerator, node: ResourceNode): void {
  if (node.body) {
    generateNode(generator, node.body)
  } else {
    generator.push('null')
  }
}

function generateNode(generator: CodeGenerator, node: Node): void {
  const { helper } = generator
  switch (node.type) {
    case NodeTypes.Resource:
      generateResource(generator, node as ResourceNode)
      break
    case NodeTypes.Plural:
      generatePluralNode(generator, node as PluralNode)
      break
    case NodeTypes.Message:
      generateMessageNode(generator, node as MessageNode)
      break
    case NodeTypes.Linked:
      generateLinkedNode(generator, node as LinkedNode)
      break
    case NodeTypes.LinkedModifier:
      generator.push(JSON.stringify((node as LinkedModitierNode).value))
      break
    case NodeTypes.LinkedKey:
      generator.push(JSON.stringify((node as LinkedKeyNode).value))
      break
    case NodeTypes.List:
      generator.push(
        `${helper(HelperNameMap.INTERPOLATE)}(${helper(HelperNameMap.LIST)}(${
          (node as ListNode).index
        }))`
      )
      break
    case NodeTypes.Named:
      generator.push(
        `${helper(HelperNameMap.INTERPOLATE)}(${helper(
          HelperNameMap.NAMED
        )}(${JSON.stringify((node as NamedNode).key)}))`
      )
      break
    case NodeTypes.Literal:
      generator.push(JSON.stringify((node as LiteralNode).value))
      break
    case NodeTypes.Text:
      generator.push(JSON.stringify((node as TextNode).value))
      break
    default:
      if (__DEV__) {
        throw new Error(`unhandled codegen node type: ${node.type}`)
      }
  }
}

// generate code from AST
/** @internal */
export const generate = (
  ast: ResourceNode,
  options: CodeGenOptions = {} // eslint-disable-line
): string => {
  const mode = isString(options.mode) ? options.mode : 'normal'
  const helpers = ast.helpers || []
  const generator = createCodeGenerator(ast.loc && ast.loc.source)

  generator.push(mode === 'normal' ? `function __msg__ (ctx) {` : `(ctx) => {`)
  generator.indent()

  if (helpers.length > 0) {
    generator.push(
      `const { ${helpers.map(s => `${s}: _${s}`).join(', ')} } = ctx`
    )
    generator.newline()
  }

  generator.push(`return `)
  generateNode(generator, ast)
  generator.deindent()
  generator.push(`}`)

  return generator.context().code
}
