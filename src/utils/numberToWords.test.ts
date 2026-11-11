import test from 'node:test';
import assert from 'node:assert/strict';
import { numberToWords } from './numberToWords';

test('converts basic whole numbers in USD', () => {
  assert.equal(numberToWords(0, 'USD'), 'Zero Only');
  assert.equal(numberToWords(1, 'USD'), 'One Dollars Only');
  assert.equal(numberToWords(25, 'USD'), 'Twenty Five Dollars Only');
  assert.equal(numberToWords(100, 'USD'), 'One Hundred Dollars Only');
  assert.equal(numberToWords(1250, 'USD'), 'One Thousand Two Hundred Fifty Dollars Only');
  assert.equal(numberToWords(54000, 'USD'), 'Fifty Four Thousand Dollars Only');
});

test('converts decimal amounts with cents', () => {
  assert.equal(numberToWords(50.25, 'USD'), 'Fifty Dollars and Twenty Five Cents Only');
  assert.equal(numberToWords(1250.50, 'USD'), 'One Thousand Two Hundred Fifty Dollars and Fifty Cents Only');
});

test('handles Indian Rupees and numbering system', () => {
  assert.equal(numberToWords(100000, 'INR'), 'One Lakh Rupees Only');
  assert.equal(numberToWords(1500000, '₹'), 'Fifteen Lakh Rupees Only');
  assert.equal(numberToWords(75000.50, 'INR'), 'Seventy Five Thousand Rupees and Fifty Paise Only');
});

test('handles other currencies like EUR and GBP', () => {
  assert.equal(numberToWords(3200, 'EUR'), 'Three Thousand Two Hundred Euros Only');
  assert.equal(numberToWords(4500, 'GBP'), 'Four Thousand Five Hundred Pounds Only');
});
