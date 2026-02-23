import { describe, expect, it } from 'vitest';

import { calculateLCOM4, extractClassInfo } from '../../../ast/lcom4.js';

describe('lcom4', () => {
  describe('extractClassInfo', () => {
    it('should extract fields and methods from a class', async () => {
      const source = `
        class Calculator {
          private result: number = 0;
          private history: number[] = [];
          add(a: number, b: number): number {
            this.result = a + b;
            this.history.push(this.result);
            return this.result;
          }
          getResult(): number {
            return this.result;
          }
        }
      `;
      const info = await extractClassInfo(source, 'Calculator');

      expect(info).toBeDefined();
      expect(info!.name).toBe('Calculator');
      expect(info!.fields).toContain('result');
      expect(info!.fields).toContain('history');
      expect(info!.methods.length).toBe(2);
    });

    it('should return null for non-existent class', async () => {
      const source = `const x = 1;`;
      const info = await extractClassInfo(source, 'Foo');

      expect(info).toBeNull();
    });

    it('should detect field access via this keyword', async () => {
      const source = `
        class Foo {
          private a: number = 0;
          private b: string = '';
          methodA() { this.a = 1; }
          methodB() { this.b = 'x'; }
        }
      `;
      const info = await extractClassInfo(source, 'Foo');

      expect(info!.methods[0].accessedFields).toContain('a');
      expect(info!.methods[0].accessedFields).not.toContain('b');
      expect(info!.methods[1].accessedFields).toContain('b');
      expect(info!.methods[1].accessedFields).not.toContain('a');
    });
  });

  describe('calculateLCOM4', () => {
    it('should return 1 for a cohesive class', async () => {
      // All methods share the same fields
      const source = `
        class Cohesive {
          private x: number = 0;
          setX(val: number) { this.x = val; }
          getX(): number { return this.x; }
        }
      `;
      const result = await calculateLCOM4(source, 'Cohesive');

      expect(result.value).toBe(1);
      expect(result.components).toHaveLength(1);
    });

    it('should return 2 for a class with two disconnected groups', async () => {
      // Two groups: {connect, disconnect} share dbConnection; {log, getLog} share logger
      const source = `
        class MixedResponsibility {
          private dbConnection: any = null;
          private logger: any = null;
          connect() { this.dbConnection = {}; }
          disconnect() { this.dbConnection = null; }
          log(msg: string) { this.logger = msg; }
          getLog() { return this.logger; }
        }
      `;
      const result = await calculateLCOM4(source, 'MixedResponsibility');

      expect(result.value).toBe(2);
      expect(result.components).toHaveLength(2);
    });

    it('should return method and field counts', async () => {
      const source = `
        class Foo {
          private a: number = 0;
          private b: number = 0;
          getA() { return this.a; }
          getB() { return this.b; }
        }
      `;
      const result = await calculateLCOM4(source, 'Foo');

      expect(result.methodCount).toBe(2);
      expect(result.fieldCount).toBe(2);
    });

    it('should return value 0 for class with no methods', async () => {
      const source = `
        class Empty {
          private x: number = 0;
        }
      `;
      const result = await calculateLCOM4(source, 'Empty');

      expect(result.value).toBe(0);
      expect(result.methodCount).toBe(0);
    });

    it('should handle class with single method accessing all fields', async () => {
      const source = `
        class Single {
          private a: number = 0;
          private b: string = '';
          private c: boolean = false;
          doAll() {
            this.a = 1;
            this.b = 'x';
            this.c = true;
          }
        }
      `;
      const result = await calculateLCOM4(source, 'Single');

      expect(result.value).toBe(1);
      expect(result.components).toHaveLength(1);
    });
  });
});
