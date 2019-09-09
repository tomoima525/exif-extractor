export class FractionValue {
  value: number;
  denominator: number;
  numerator: number;

  constructor(value: number, denominator: number, numerator: number) {
    this.value = value;
    this.denominator = denominator;
    this.numerator = numerator;
  }

  toString() {
    return `value: ${this.value} denominator: ${this.denominator} numerator: ${this.numerator}`;
  }
}
