import db from "../models/index.js";

const Specialization = db.Specialization;
const Profession = db.Profession;

// Create Specialization
export const createSpecialization = async (req, res) => {
  try {
    const {
      profession_id,
      specialization_name,
      description,
      is_active,
    } = req.body;

    if (!profession_id || !specialization_name) {
      return res.status(400).json({
        message: "Profession and Specialization name are required",
      });
    }

    const profession = await Profession.findByPk(profession_id);

    if (!profession) {
      return res.status(404).json({
        message: "Profession not found",
      });
    }

    const data = await Specialization.create({
      profession_id,
      specialization_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Specialization created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get All Specializations
export const getSpecializations = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await Specialization.findAndCountAll({
      include: [
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
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
      message: "Error fetching specializations",
      error: error.message,
    });
  }
};

// Get Active Specializations
export const getActiveSpecializations = async (req, res) => {
  try {
    const data = await Specialization.findAll({
      where: {
        is_active: true,
      },
      include: [
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
      ],
      order: [["specialization_name", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Get Specialization By ID
export const getSpecializationById = async (req, res) => {
  try {
    const data = await Specialization.findByPk(req.params.id, {
      include: [
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
      ],
    });

    if (!data) {
      return res.status(404).json({
        message: "Specialization not found",
      });
    }

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Update Specialization
export const updateSpecialization = async (req, res) => {
  try {
    const data = await Specialization.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Specialization not found",
      });
    }

    const {
      profession_id,
      specialization_name,
      description,
      is_active,
    } = req.body;

    if (profession_id) {
      const profession = await Profession.findByPk(profession_id);

      if (!profession) {
        return res.status(404).json({
          message: "Profession not found",
        });
      }

      data.profession_id = profession_id;
    }

    data.specialization_name =
      specialization_name || data.specialization_name;

    data.description =
      description !== undefined ? description : data.description;

    data.is_active =
      is_active !== undefined ? is_active : data.is_active;

    data.updated_at = new Date();

    await data.save();

    res.status(200).json({
      message: "Specialization updated successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

// Delete Specialization
export const deleteSpecialization = async (req, res) => {
  try {
    const data = await Specialization.findByPk(req.params.id);

    if (!data) {
      return res.status(404).json({
        message: "Specialization not found",
      });
    }

    await data.destroy();

    res.status(200).json({
      message: "Specialization deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};