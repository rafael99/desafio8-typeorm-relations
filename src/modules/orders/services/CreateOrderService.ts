import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // Verificando se customer existe
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('This customer does not exist');
    }

    // Verificando se todos os produtos foram encontrados
    const productsFounded = await this.productsRepository.findAllById(products);

    if (!productsFounded.length) {
      throw new AppError('Could not find any product by ids');
    }

    // Verificando se produto específico existe
    const productsFoundedIds = productsFounded.map(
      productFounded => productFounded.id,
    );

    const checkProductInexistence = products.filter(product => {
      return !productsFoundedIds.includes(product.id);
    });

    if (checkProductInexistence.length) {
      throw new AppError(
        `The product with ID '${checkProductInexistence[0].id}' does not exist`,
      );
    }

    // Verificando a quantidade requerida com a quantidade disponível
    const productQuantityIsAvailable = productsFounded.filter(product => {
      const productToInsert = products.find(p => p.id === product.id);

      if (!productToInsert) {
        return product;
      }

      return productToInsert.quantity > product.quantity;
    });

    if (productQuantityIsAvailable.length > 0) {
      throw new AppError(
        `The product's quantity with ID '${productQuantityIsAvailable[0].id}' is less than the quantity required`,
      );
    }

    // Formatando e criando pedidos
    const productsFormatted = products.map(product => {
      const { price } = productsFounded.filter(p => p.id === product.id)[0];

      return {
        product_id: product.id,
        price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsFormatted,
    });

    // Atualizando a quantidade
    await this.productsRepository.updateQuantity(products);

    return order;
  }
}

export default CreateOrderService;
