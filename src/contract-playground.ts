import { readFileSync } from 'fs';
import { VM } from 'vm2';
import * as ts from 'typescript';
import { inspect } from 'util';

const contractCode = `
function transfer({ from, to, amount }) {
  return amount;
}
`;

const contractInfo = {
  name: 'Test contract',
  description: 'Contract for testing purposes',
  methods: [
    {
      name: 'transfer',
      params: {
        type: 'object',
        properties: {
          from: { type: 'string' },
          to: { type: 'string' },
          amount: { type: 'string' },
        },
        required: ['from', 'to', 'amount'],
      },
    },
  ],
};

interface ContractMethod {
  name: string;
  params: any;
}

interface ContractMethodCall {
  name: string;
  params: any;
}

interface ContractDeclaration {
  name: string;
  description: string;
  methods: ContractMethod[];
}

interface Contract {
  declaration: ContractDeclaration;
  code: string;
}

function makeCallCode(methodCall: ContractMethodCall): string {
  const method = methodCall.name;
  if (method.match(/[^a-z0-9_]/i)) {
    throw new Error('Illegal method name');
  }
  const paramsSerialized = JSON.stringify(methodCall.params);
  return `;${method}(${paramsSerialized})`;
}

function callMethod(contract: Contract, methodCall: ContractMethodCall) {
  const vm = new VM({
    timeout: 1000,
    sandbox: {},
  });

  const method = contract.declaration.methods.find(method => method.name == methodCall.name);
  if (!method) {
    throw new Error('Trying to call unknown method');
  }

  const callCode = makeCallCode(methodCall);
  const code = contract.code + callCode;
  const result = vm.run(code);

  return result;
}

const contract = { declaration: contractInfo, code: contractCode };
const result = callMethod(contract, {
  name: 'transfer',
  params: {
    from: 'a',
    to: 'b',
    amount: '100',
  },
});

console.log(result);
