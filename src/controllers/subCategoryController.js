import db from "../models/index.js";

const SubCategory = db.SubCategory;
const Category = db.Category;

// Create Sub Category
export const createSubCategory = async (req, res) => {
  try {
    const { category_id, sub_category_name, description, is_active } = req.body;

    if (!category_id || !sub_category_name) {
      return res.status(400).json({
        message: "Category and Sub Category name are required",
      });
    }

    const category = await Category.findByPk(category_id);

    if (!category) {
      return res.status(404).json({
        message: "Category not found",
      });
    }

    const data = await SubCategory.create({
      category_id,
      sub_category_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Sub Category created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get All Sub Categories
export const getSubCategories = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await SubCategory.findAndCountAll({
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
      ],
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
      message: "Error fetching sub categories",
      error: error.message,
    });
  }
};

// Get Active Sub Categories
export const getActiveSubCategories = async (req, res) => {
  try {
    const data = await SubCategory.findAll({
      where: {
        is_active: true,
      },
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
      ],
      order: [["sub_category_name", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get Sub Category By ID
export const getSubCategoryById = async (req, res) => {
  try {
    const data = await SubCategory.findByPk(req.params.id, {
      include: [
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
      ],
    });

    if (!data) {
      return res.status(404).json({
        message: "Sub Category not found",
      });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Sub Category
export const updateSubCategory = async (req, res) => {
  try {
    const data = await SubCategory.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Sub Category not found",
      });
    }

    const {
      category_id,
      sub_category_name,
      description,
      is_active,
    } = req.body;

    if (category_id) {
      const category = await Category.findByPk(category_id);

      if (!category) {
        return res.status(404).json({
          message: "Category not found",
        });
      }

      data.category_id = category_id;
    }

    data.sub_category_name =
      sub_category_name || data.sub_category_name;

    data.description =
      description !== undefined ? description : data.description;

    data.is_active =
      is_active !== undefined ? is_active : data.is_active;

    data.updated_at = new Date();

    await data.save();

    res.status(200).json({
      message: "Sub Category updated successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Sub Category
export const deleteSubCategory = async (req, res) => {
  try {
    const data = await SubCategory.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Sub Category not found",
      });
    }

    await data.destroy();

    res.status(200).json({
      message: "Sub Category deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};