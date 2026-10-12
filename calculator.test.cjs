const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function calculator() {
  const html = fs.readFileSync(`${__dirname}/calculator.html`, 'utf8');
  const display = { value: '0' };
  const handlers = {};
  const context = vm.createContext({ document: {
    querySelector: selector => selector === '#display' ? display : {
      addEventListener: (type, handler) => { handlers.click = handler; }
    },
    addEventListener: (type, handler) => { handlers.keydown = handler; }
  } });
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1], context);
  return {
    display,
    evaluate: source => context.evaluateExpression(source),
    click: value => handlers.click({ target: { closest: () => ({ dataset:
      ['clear', 'delete', 'equals'].includes(value) ? { action: value } : { value }
    }) } }),
    key: key => handlers.keydown({ key, preventDefault() {} })
  };
}

for (const [name, source, expected] of [
  ['addition', '12+8', 20], ['subtraction', '12-8', 4],
  ['multiplication', '12*8', 96], ['division', '12/8', 1.5],
  ['precedence', '2+3*4-8/2', 10], ['left associativity', '24/3/2', 4],
  ['negative operands', '-3*-2', 6], ['negative result', '2-5', -3],
  ['decimals', '0.1+0.2', 0.3], ['percentage', '200*10%', 20],
  ['small result', '0.000001*0.000001', 1e-12],
  ['scientific result reuse', '1e+21/10', 1e20]
]) test(name, () => assert.equal(calculator().evaluate(source), expected));

test('invalid expressions and division by zero are rejected', () => {
  const app = calculator();
  for (const source of ['1/0', '0/0', '2+', '1..2', '2**3', 'alert(1)', '1e309']) {
    assert.throws(() => app.evaluate(source));
  }
});

test('all four operations work through buttons and keyboard', () => {
  for (const method of ['click', 'key']) {
    for (const [operator, expected] of [['+', '10'], ['-', '6'], ['*', '16'], ['/', '4']]) {
      const app = calculator();
      for (const key of ['8', operator, '2', method === 'click' ? 'equals' : 'Enter']) app[method](key);
      assert.equal(app.display.value, expected);
    }
  }
});

test('errors remain visible and input recovers', () => {
  const app = calculator();
  for (const key of ['1', '/', '0', 'equals']) app.click(key);
  assert.equal(app.display.value, 'Error');
  app.click('4');
  assert.equal(app.display.value, '4');
});

test('results can be continued or replaced with a new number', () => {
  const app = calculator();
  for (const key of ['2', '+', '3', 'equals', '*', '4', 'equals']) app.click(key);
  assert.equal(app.display.value, '20');
  app.click('7');
  assert.equal(app.display.value, '7');
});

test('decimal input, delete, and clear', () => {
  const app = calculator();
  for (const key of ['.', '5', '.', '2']) app.key(key);
  assert.equal(app.display.value, '0.52');
  app.key('Backspace');
  assert.equal(app.display.value, '0.5');
  app.key('Escape');
  assert.equal(app.display.value, '0');
  app.click('9');
  app.click('delete');
  assert.equal(app.display.value, '0');
  app.click('8');
  app.click('clear');
  assert.equal(app.display.value, '0');
});
