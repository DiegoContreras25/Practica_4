import { ObjectId, type OptionalId } from "mongodb";

export type userModel = OptionalId<{
    name: string;
    email: string;
    password: string;
    cart: cart;
    orders: ObjectId[];
}>;


export type productModel = OptionalId<{
    name: string;
    description: string;
    price: number;
    stock: number;
}>;

export type cartModel = OptionalId<{
    userid: string;
    products: Array<{
      productId: ObjectId;
      quantity: number;
    }>;
    total: number; // Calculado automáticamente
  }>;
  

export type orderModel = OptionalId<{
    userid: string;
    products: ObjectId[];
    total: number;
    orderdate: Date;
}>;

export type user = {
    id: string;
    name: string;
    email: string;
    password: string;
    cart: cart;
    orders: order[];
};
export type product = {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
}
export type cart = {
    id: string;
    userid: string;
    products: Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      total: number; // price * quantity
    }>;
    total: number; // Suma de todos los totales de los productos
  };
  

export type order = {
    id: string;
    userid: string;
    products: product[];
    total: number;
    orderdate: Date;
};