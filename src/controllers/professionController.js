import db from "../models/index.js";

const Profession = db.Profession;
const SubCategory = db.SubCategory;

// Create Profession
export const createProfession = async (req, res) => {
  try {
    const { sub_category_id, profession_name, description, is_active } = req.body;

    if (!sub_category_id || !profession_name) {
      return res.status(400).json({
        message: "Sub Category and Profession name are required",
      });
    }

    const subCategory = await SubCategory.findByPk(sub_category_id);

    if (!subCategory) {
      return res.status(404).json({
        message: "Sub Category not found",
      });
    }

    const data = await Profession.create({
      sub_category_id,
      profession_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Profession created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get All Professions
export const getProfessions = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await Profession.findAndCountAll({
      include: [
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
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
      message: "Error fetching professions",
      error: error.message,
    });
  }
};

// Get Active Professions
export const getActiveProfessions = async (req, res) => {
  try {
    const data = await Profession.findAll({
      where: {
        is_active: true,
      },
      include: [
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
      ],
      order: [["profession_name", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get Profession By ID
export const getProfessionById = async (req, res) => {
  try {
    const data = await Profession.findByPk(req.params.id, {
      include: [
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
      ],
    });

    if (!data) {
      return res.status(404).json({
        message: "Profession not found",
      });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Profession
export const updateProfession = async (req, res) => {
  try {
    const data = await Profession.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Profession not found",
      });
    }

    const {
      sub_category_id,
      profession_name,
      description,
      is_active,
    } = req.body;

    if (sub_category_id) {
      const subCategory = await SubCategory.findByPk(sub_category_id);

      if (!subCategory) {
        return res.status(404).json({
          message: "Sub Category not found",
        });
      }

      data.sub_category_id = sub_category_id;
    }

    data.profession_name =
      profession_name || data.profession_name;

    data.description =
      description !== undefined ? description : data.description;

    data.is_active =
      is_active !== undefined ? is_active : data.is_active;

    data.updated_at = new Date();

    await data.save();

    res.status(200).json({
      message: "Profession updated successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Profession
export const deleteProfession = async (req, res) => {
  try {
    const data = await Profession.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Profession not found",
      });
    }

    await data.destroy();

    res.status(200).json({
      message: "Profession deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};