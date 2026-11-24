# cart contracts

### cart.Cart
Kind: entity · Status: active
A shopping cart: its lines, in the order added, and their total.
Code: Cart

#### cart.Cart.lines
The lines of the cart, in the order added. Type: cart.Line[]

#### cart.Cart.totalCents
The sum of priceCents × quantity over all lines. Type: int

### cart.Line
Kind: type · Status: active
One line of the cart.
Code: Line

#### cart.Line.name
What was added. Type: string

#### cart.Line.priceCents
The price of one item, in cents. Type: int

#### cart.Line.quantity
How many of the item. Type: int

### cart.AddItem
Kind: operation · Status: active
Adds a line to the cart.
Code: Cart.add
Output: null | cart.InvalidQuantity

#### cart.AddItem.name
The item's name. Type: string

#### cart.AddItem.priceCents
The price of one item, in cents. Type: int

#### cart.AddItem.quantity
How many to add. Type: int

### cart.InvalidQuantity
Kind: error · Status: active
The quantity is below 1.
Code: CartError.invalidQuantity
