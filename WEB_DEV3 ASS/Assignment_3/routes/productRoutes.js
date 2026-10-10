const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

/**
 * @route   GET /api/products/summary
 * @desc    Category-wise inventory summary via MongoDB Aggregation
 */
router.get('/summary', async (req, res, next) => {
  try {
    const summary = await Product.aggregate([
      {
        $group: {
          _id: '$category',
          totalItems: { $sum: 1 },
          totalQuantity: { $sum: '$quantity' },
          totalStockValue: {
            $sum: {$multiply: ['$price', '$quantity'] }
          },
          avgPrice: { $avg: '$price' }
        }
      },
      {
        $project: {
          _id: 0,
          id: '$_id',
          totalItems: 1,
          totalQuantity: 1,
          totalStockValue: 1,
          avgPrice: { $round: ['$avgPrice', 1] }
        }
      }
    ]);

    res.status(200).json({
      categories: summary.length,
      summary
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/products/low-stock
 * @desc    Get low-stock alert report ($expr: quantity <= reorderLevel)
 */
router.get('/low-stock', async (req, res, next) => {
  try {
    const lowStockItems = await Product.find({
      $expr: {$lte: ['$quantity', '$reorderLevel'] }
    });

    res.status(200).json({
      count: lowStockItems.length,
      lowStockItems
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   POST /api/products
 * @desc    Create a new product
 */
router.post('/', async (req, res, next) => {
  try {
    const product = await Product.create(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/products
 * @desc    Get all products with filtering, sorting & pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const { category, search, minPrice, maxPrice, sortBy, order, page = 1, limit = 10 } = req.query;

    let query = {};

    // Category filter
    if (category) {
      query.category = category;
    }

    // Name or SKU search filter
    if (search) {
      query.$or = [
        { name: { $regex: search,$options: 'i' } },
        { sku: { $regex: search,$options: 'i' } }
      ];
    }

    // Price range filtering
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Sorting
    let sortOptions = {};
    if (sortBy) {
      const sortOrder = order === 'desc' ? -1 : 1;
      sortOptions[sortBy] = sortOrder;
    } else {
      sortOptions.createdAt = -1;
    }

    // Pagination
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limitNum);

    const count = products.length;
    const totalPages = Math.ceil(total / limitNum) || 1;

    res.status(200).json({
      total,
      page: pageNum,
      totalPages,
      count,
      products
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   GET /api/products/:id
 * @desc    Get single product by ID
 */
router.get('/:id', async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PUT /api/products/:id
 * @desc    Update full product details
 */
router.put('/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json(product);
  } catch (err) {
    next(err);
  }
});

/**
 * @route   PATCH /api/products/:id/stock
 * @desc    Safely adjust stock level (increment/decrement)
 */
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { change } = req.body;

    if (change === undefined || typeof change !== 'number') {
      return res.status(400).json({ success: false, message: 'Please provide a valid stock change number' });
    }

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Prevent stock quantity from dropping below zero
    if (product.quantity + change < 0) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock! Current stock is ${product.quantity}, cannot reduce by ${Math.abs(change)}.`
      });
    }

    product.quantity += change;
    await product.save();

    res.status(200).json({
      message: 'Stock updated',
      product
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @route   DELETE /api/products/:id
 * @desc    Delete product by ID
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    res.status(200).json({
      message: 'Product deleted',
      id: req.params.id
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;