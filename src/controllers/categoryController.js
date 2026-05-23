import db from "../models/index.js";

const Category = db.Category;

// Create
export const createCategory = async (req, res) => {
  try {
    const { category_name, description, is_active } = req.body;

    if (!category_name)
      return res.status(400).json({ message: "Category name required" });

    const data = await Category.create({
      category_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Category created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Categories
export const getCategories = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await Category.findAndCountAll({
      limit,
      offset,
      order: [["id", "DESC"]],
    });

    res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: rows,
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching categories",
      error: error.message,
    });
  }
};

// Get Active Categories
export const getActiveCategories = async (req, res) => {
  try {
    const data = await Category.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Category By ID
export const getCategoryById = async (req, res) => {
  try {
    const data = await Category.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Category
export const updateCategory = async (req, res) => {
  try {
    const data = await Category.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    const { category_name, description, is_active } = req.body;

    data.category_name = category_name || data.category_name;
    data.description =
      description !== undefined ? description : data.description;
    data.is_active = is_active !== undefined ? is_active : data.is_active;

    await data.save();

    res.status(200).json({
      message: "Updated successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Category
export const deleteCategory = async (req, res) => {
  try {
    const data = await Category.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    await data.destroy();

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};