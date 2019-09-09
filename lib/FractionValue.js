"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var FractionValue = /** @class */ (function () {
    function FractionValue(value, denominator, numerator) {
        this.value = value;
        this.denominator = denominator;
        this.numerator = numerator;
    }
    FractionValue.prototype.toString = function () {
        return "value: " + this.value + " denominator: " + this.denominator + " numerator: " + this.numerator;
    };
    return FractionValue;
}());
exports.FractionValue = FractionValue;
//# sourceMappingURL=FractionValue.js.map