import 'package:cart/cart.dart';
import 'package:test/test.dart';

void main() {
  test('CRT-002/S1 Total of several lines', () {
    final cart = Cart()
      ..add('apple', 120, 2)
      ..add('pear', 75, 1);
    expect(cart.totalCents, 315);
  });

  test('CRT-002/S2 Empty cart', () {
    expect(Cart().totalCents, 0);
  });
}
