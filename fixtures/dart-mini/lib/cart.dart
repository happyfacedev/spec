/// One item in the cart (cart.Cart.lines).
class Line {
  const Line(this.name, this.priceCents, this.quantity);

  final String name;
  final int priceCents;
  final int quantity;
}

/// The error values of cart operations.
enum CartError { invalidQuantity }

/// cart.Cart: the lines of a shopping cart and their total, in whole cents (INV-001).
class Cart {
  final List<Line> _lines = [];

  /// cart.Cart.lines, in the order added.
  List<Line> get lines => List.unmodifiable(_lines);

  /// cart.Cart.totalCents
  int get totalCents => _lines.fold(0, (sum, l) => sum + l.priceCents * l.quantity);

  /// cart.AddItem: null on success, else the error value.
  CartError? add(String name, int priceCents, int quantity) {
    if (quantity < 1) return CartError.invalidQuantity;
    _lines.add(Line(name, priceCents, quantity));
    return null;
  }
}
