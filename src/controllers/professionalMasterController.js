import db from "../models/index.js";
const ProfessionalMaster = db.ProfessionalMaster;

// Create
export const createProfession = async (req, res) => {
  try {
    const { profession_name, description, is_active } = req.body;

    if (!profession_name) {
      return res.status(400).json({ message: "Profession name is required" });
    }

    const data = await ProfessionalMaster.create({
      profession_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Profession created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All
export const getProfessions = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await ProfessionalMaster.findAndCountAll({
      limit,
      offset,
      order: [["id", "ASC"]],
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
    res.status(500).json({ message: error.message });
  }
};

// Active
export const getActiveProfessions = async (req, res) => {
  try {
    const data = await ProfessionalMaster.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get By ID
export const getProfessionById = async (req, res) => {
  try {
    const data = await ProfessionalMaster.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update
export const updateProfession = async (req, res) => {
  try {
    const data = await ProfessionalMaster.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    const { profession_name, description, is_active } = req.body;

    data.profession_name = profession_name || data.profession_name;
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

// Delete
export const deleteProfession = async (req, res) => {
  try {
    const data = await ProfessionalMaster.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    await data.destroy();

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};