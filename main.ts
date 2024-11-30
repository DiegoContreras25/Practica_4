// PRACTICA 4
// GUILLERMO LOPEZ && DIEGO CONTRERAS

import { MongoClient, ObjectId } from "mongodb";
import type {  userModel, cartModel, productModel, orderModel } from "./types.ts";
import { fromModelToUser,fromModelToOrder,fromModelToProduct, fromModelToCart } from "./utils.ts";

const MONGO_URL = Deno.env.get("MONGO_DB");
if (!MONGO_URL) {
  console.error("MONGO URL API KEY NOT WORKIN");
  Deno.exit(1);
}

const dbuser = new MongoClient(MONGO_URL);
await dbuser.connect();
console.info("🚀 Connected to MongoDB 🚀");

const db = dbuser.db("Comercio_Electronico");

const userCollection = db.collection<userModel>("user");
const orderCollection = db.collection<orderModel>("Order");
const cartCollection = db.collection<cartModel>("Cart");
const productCollection = db.collection<productModel>("Product");

const handler = async (req: Request): Promise<Response> => {
  const method = req.method;
  const url = new URL(req.url);
  const path = url.pathname;

  if (method === "GET") {
             if (path === "/users") {
        const name = url.searchParams.get("name");
        try {
          if (!name) {
            // Obtiene todos los usuarios
            const usersDB = await userCollection.find().toArray();
            const users = await Promise.all(
              usersDB.map((u) =>
                fromModelToUser(u, orderCollection, productCollection, cartCollection) // Pasar cartCollection
              )
            );
            return new Response(JSON.stringify(users), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          } else {
            // Filtra usuarios por nombre
            const usersDB = await userCollection.find({ name }).toArray();
            const users = await Promise.all(
              usersDB.map((u) =>
                fromModelToUser(u, orderCollection, productCollection, cartCollection) // Pasar cartCollection
              )
            );
            return new Response(JSON.stringify(users), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }
        } catch (error) {
          console.error("Error fetching users:", error);
          return new Response("Error fetching users", { status: 500 });
        }
       }else if (path.startsWith("/carts")) {
      const userId = url.searchParams.get("userId");
      if (!userId) {
        return new Response("User ID is required", { status: 400 });
      }
    
      try {
        const cart = await cartCollection.findOne({ userid: userId });
        if (!cart) {
          return new Response("Cart not found", { status: 404 });
        }
    
        const processedCart = await fromModelToCart(cart, productCollection);
        return new Response(JSON.stringify(processedCart), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error fetching cart:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
   }   else if (path === "/products"){
      try {
        const productsDB = await productCollection.find().toArray();
        const products = productsDB.map((p) => fromModelToProduct(p));
        return new Response(JSON.stringify(products), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error fetching products:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
     } else if (path === "/orders") {
      try {
        const ordersDB = await orderCollection.find().toArray();
        const orders = ordersDB.map((o) => fromModelToOrder(o, productCollection));
        return new Response(JSON.stringify(orders), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (error) {
        console.error("Error fetching orders:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    
}} else if (method === "POST") {
            if (path === "/users") {
      try {
        const user = await req.json();
        if (!user.name || !user.email || !user.password) {
          return new Response("Bad request", { status: 400 });
        }

        const userDB = await userCollection.findOne({ email: user.email });
        if (userDB) {
          return new Response("user already exists", { status: 409 });
        }

        const { insertedId } = await userCollection.insertOne({
          name: user.name,
          password: user.password,
          email: user.email,
          cart: { userid: "", products: [] }, // Carrito vacío inicializado
          orders: [],
        });

        return new Response(
          JSON.stringify({ name: user.name, email: user.email, password: user.password, id: insertedId }),
          { status: 201 }
        );
      } catch (error) {
        console.error("Error creating user:", error);
        return new Response("Internal Server Error", { status: 500 });
      }
    }  else if (path === "/products") {
      try {
        const product = await req.json();
        if (!product.name || !product.price || !product.description) {
          return new Response("Bad request", { status: 400 });
        }
        const { insertedId } = await productCollection.insertOne({
          name: product.name,
          price: product.price,
          description: product.description,
          stock: product.stock,
        });
        return new Response(
          JSON.stringify({ name: product.name, price: product.price, description: product.description, id: insertedId,stock: product.stock }),
          { status: 201 }
        );
      }
        catch (error) {
          console.error("Error creating product:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      }else if (path === "/carts/products") {
        const userId = url.searchParams.get("userId");
        if (!userId) {
          return new Response("User ID is required", { status: 400 });
        }
      
        try {
          const body = await req.json();
          const { productId, quantity } = body;
      
          if (!productId || !quantity || quantity <= 0) {
            return new Response("Invalid product or quantity", { status: 400 });
          }
      
          // Buscar el producto en la base de datos
          const product = await productCollection.findOne({ _id: new ObjectId(productId) });
          if (!product) {
            return new Response(`Product with ID ${productId} not found`, { status: 404 });
          }
      
          // Verificar si hay suficiente stock
          if (product.stock < quantity) {
            return new Response(`Insufficient stock for product ID ${productId}`, { status: 400 });
          }
      
          // Buscar el carrito del usuario
          let cart = await cartCollection.findOne({ userid: userId });
      
          if (!cart) {
            // Si no hay carrito, crearlo
            const { insertedId } = await cartCollection.insertOne({
              userid: userId,
              products: [{ productId: new ObjectId(productId), quantity }],
              total: product.price * quantity,
            });
            cart = await cartCollection.findOne({ _id: insertedId });
          } else {
            // Si hay carrito, actualizarlo
            const existingProduct = cart.products.find((p) =>
              p.productId.equals(new ObjectId(productId))
            );
      
            if (existingProduct) {
              // Si el producto ya está en el carrito, aumentar la cantidad
              existingProduct.quantity += quantity;
            } else {
              // Si no está, agregarlo
              cart.products.push({ productId: new ObjectId(productId), quantity });
            }
      
            // Recalcular el total
            const products = await Promise.all(
              cart.products.map(async ({ productId, quantity }) => {
                const product = await productCollection.findOne({ _id: productId });
                return product ? product.price * quantity : 0;
              })
            );
            cart.total = products.reduce((sum, price) => sum + price, 0);
      
            // Guardar los cambios en el carrito
            await cartCollection.updateOne(
              { _id: cart._id },
              { $set: { products: cart.products, total: cart.total } }
            );
          }
      
          // Restar del stock del producto
          await productCollection.updateOne(
            { _id: new ObjectId(productId) },
            { $inc: { stock: -quantity } }
          );
      
          // Responder con el carrito actualizado
          const updatedCart = await fromModelToCart(cart, productCollection);
          return new Response(JSON.stringify(updatedCart), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          console.error("Error updating cart:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      }else if (path === "/orders") {
          const userId = url.searchParams.get("userId");
          if (!userId) {
            return new Response("User ID is required", { status: 400 });
          }
        
          try {
            // Buscar el carrito del usuario
            const cart = await cartCollection.findOne({ userid: userId });
            if (!cart || cart.products.length === 0) {
              return new Response("Cart is empty, cannot create order", { status: 400 });
            }
        
            // Procesar los productos del carrito
            const products = await Promise.all(
              cart.products.map(async ({ productId, quantity }) => {
                const product = await productCollection.findOne({ _id: productId });
                if (!product) {
                  throw new Error(`Product with ID ${productId} not found`);
                }
                if (product.stock < quantity) {
                  throw new Error(
                    `Insufficient stock for product ID ${productId}: Available ${product.stock}, Requested ${quantity}`
                  );
                }
        
                // Restar del stock
                await productCollection.updateOne(
                  { _id: productId },
                  { $inc: { stock: -quantity } }
                );
        
                return {
                  productId: product._id.toString(),
                  name: product.name,
                  quantity,
                  price: product.price,
                  total: product.price * quantity,
                };
              })
            );
        
            // Calcular el total del pedido
            const total = products.reduce((sum, p) => sum + p.total, 0);
        
            // Crear el pedido
            const { insertedId: orderId } = await orderCollection.insertOne({
              userid: userId,
              products: products.map(({ productId, quantity, price }) => ({
                productId: new ObjectId(productId),
                quantity,
                price,
              })),
              total,
              orderdate: new Date(),
            });
        
            // Eliminar el carrito después de confirmar el pedido
            await cartCollection.deleteOne({ userid: userId });
        
            // Responder con el pedido creado
            return new Response(
              JSON.stringify({
                orderId: orderId.toString(),
                userId,
                products,
                total,
                date: new Date().toISOString(),
              }),
              {
                status: 201,
                headers: { "Content-Type": "application/json" },
              }
            );
          } catch (error) {
            console.error("Error creating order:", error);
            return new Response(
              `Error creating order: ${error.message}`,
              { status: 500 }
            );
          }
        }    
  }else if (method === "PUT") {
             if (path === "/carts") {
        try {
          const cart = await req.json();
          if (!cart.userid || !cart.products) {
            return new Response("Bad request", { status: 400 });
          }
          const { insertedId } = await cartCollection.insertOne({
            userid: cart.userid,
            products: cart.products,
          });
          return new Response(
            JSON.stringify({ userid: cart.userid, products: cart.products, id: insertedId }),
            { status: 201 }
          );
        } catch (error) {
          console.error("Error creating cart:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      } else if (path.startsWith("/products")) {
        const id = path.slice(10);   
        if (!id) return new Response("Product ID is required", { status: 400 });    
        try {
          const product = await req.json();
          if (!product.name || !product.price || !product.description) {
            return new Response("Bad request", { status: 400 });
          }
          const { insertedId } = await productCollection.insertOne({
            name: product.name,
            price: product.price,
            description: product.description,
            stock: product.stock,
          });
          return new Response(
            JSON.stringify({ name: product.name, price: product.price, description: product.description, id: insertedId,stock: product.stock }),
            { status: 201 }
          );
        } catch (error) {
          console.error("Error creating product:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
        
      }
} else if (method === "DELETE") {
             if (path.startsWith("/products")) {
        const id = path.slice(10);
        if (!id) return new Response("Product ID is required", { status: 400 });
        try {
          await productCollection.deleteOne({ _id: new ObjectId(id) });
          return new Response("Product deleted successfully", { status: 200 });
        } catch (error) {
          console.error("Error deleting product:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      } else if (path === "/carts") {
        try {
          const cart = await req.json();
          if (!cart.userid) {
            return new Response("Bad request", { status: 400 });
          } else {
            await cartCollection.deleteOne({ userid: cart.userid });
            return new Response("Cart deleted successfully", { status: 200 });
          }
        } catch (error) {
          console.error("Error deleting cart:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      } else if (path === "/carts/products") {
        try {
          const cart = await req.json();
          if (!cart.userid || !cart.products) {
            return new Response("Bad request", { status: 400 });
          }
          const { insertedId } = await cartCollection.insertOne({
            userid: cart.userid,
            products: cart.products,
          });
          return new Response(
            JSON.stringify({ userid: cart.userid, products: cart.products, id: insertedId }),
            { status: 201 }
          );
        } catch (error) {
          console.error("Error creating cart:", error);
          return new Response("Internal Server Error", { status: 500 });
        }
      }
 }
  
  return new Response("Endpoint not found", { status: 404 });
};

Deno.serve({ port: 3000 }, handler);
