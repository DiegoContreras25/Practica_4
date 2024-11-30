import type { Collection } from "mongodb";
import { ObjectId } from "mongodb";
import type { cart, cartModel, userModel, orderModel, productModel } from "./types.ts";
import type { user, order, product } from "./types.ts";
export const fromModelToUser = async (
  userDB: userModel,
  orderCollection: Collection<orderModel>,
  productCollection: Collection<productModel>,
  cartCollection: Collection<cartModel> // Aquí aseguramos que cartCollection se pase
): Promise<user> => {
  // Obtener el carrito asociado al usuario
  const cartDB = await cartCollection.findOne({ userid: userDB._id.toString() });

  let processedCart = null;

  if (cartDB) {
    const productsInCart = await Promise.all(
      cartDB.products.map(async (productId) => {
        const product = await productCollection.findOne({ _id: new ObjectId(productId) });
        return product
          ? { id: product._id.toString(), name: product.name, price: product.price, stock: product.stock }
          : null;
      })
    );

    processedCart = {
      id: cartDB._id.toString(),
      userid: cartDB.userid,
      products: productsInCart.filter((p) => p !== null),
    };
  }

  // Procesar las órdenes asociadas al usuario
  const orders = await orderCollection.find({ userid: userDB._id.toString() }).toArray();
  const processedOrders = await Promise.all(
    orders.map(async (o) => ({
      id: o._id.toString(),
      userid: o.userid,
      products: await Promise.all(
        o.products.map(async (productId) => {
          const product = await productCollection.findOne({ _id: new ObjectId(productId) });
          return product
            ? { id: product._id.toString(), name: product.name, price: product.price }
            : null;
        })
      ).then((products) => products.filter((p) => p !== null)),
      total: o.total,
      orderdate: o.orderdate,
    }))
  );

  // Retornar el usuario completo con carrito y órdenes procesadas
  return {
    id: userDB._id.toString(),
    name: userDB.name,
    email: userDB.email,
    password: userDB.password, // Incluye o elimina según lo necesites
    cart: processedCart,
    orders: processedOrders,
  };
};


export const fromModelToOrder = async (
    orderDB: orderModel,
    productcollection:Collection<productModel>
): Promise<order> => {
    const products = await productcollection
    .find({_id:{$in:orderDB.products}})
    .toArray();
    return{
    id: orderDB._id!.toString(),
    userid: orderDB.userid,
    products: products.map((p) => fromModelToProduct(p)),
    total: orderDB.total,
    orderdate: orderDB.orderdate,
};
};

export const fromModelToCart = async (
  cartDB: cartModel,
  productCollection: Collection<productModel>
): Promise<cart> => {
  const products = await Promise.all(
    cartDB.products.map(async ({ productId, quantity }) => {
      const product = await productCollection.findOne({ _id: productId });
      if (!product) {
        return null; // Si el producto no existe, lo ignoramos
      }
      return {
        productId: product._id.toString(),
        name: product.name,
        price: product.price,
        quantity: quantity,
        total: product.price * quantity, // Calcula el total por producto
      };
    })
  );

  const validProducts = products.filter((p) => p !== null); // Filtrar productos inválidos
  const total = validProducts.reduce((sum, p) => sum + (p?.total || 0), 0); // Calcula el total del carrito

  return {
    id: cartDB._id.toString(),
    userid: cartDB.userid,
    products: validProducts as Array<{
      productId: string;
      name: string;
      price: number;
      quantity: number;
      total: number;
    }>,
    total: total,
  };
};

export const fromModelToProduct = (model: productModel): product => ({
    id: model._id!.toString(),
    name: model.name,
    description: model.description,
    price: model.price,
    stock: model.stock,
});
