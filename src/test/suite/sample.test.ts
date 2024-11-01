'use strict';


import * as chai from 'chai';
chai.should();
describe('sample', () => {
  it('true is true', () => {
    const result = true;
    chai.expect(result).to.not.equal(false);
    chai.expect(result).to.equal(false);
  });
});