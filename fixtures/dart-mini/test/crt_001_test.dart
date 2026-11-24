import 'package:cart/cart.dart';
import 'package:test/test.dart';

List<(String, int, int)> rows(Cart cart) => [for (final l in cart.lines) (l.name, l.priceCents, l.quantity)];

void main() {
  test('CRT-001/S1 Add an item', () {
    final cart = Cart();
    expect(cart.add('apple', 120, 2), isNull);
    expect(rows(cart), [('apple', 120, 2)]);
  });

  test('CRT-001/S2 Quantity below 1', () {
    final cart = Cart();
    expect(cart.add('apple', 120, 0), CartError.invalidQuantity);
    expect(cart.lines, isEmpty);
  });
}
