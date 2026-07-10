import db from "../models/index.js";

const MemberType = db.MemberType;

// Create
export const createMemberType = async (req, res) => {
  try {
    const { member_type_name, description, is_active } = req.body;

    if (!member_type_name)
      return res.status(400).json({ message: "Member type name required" });

    const data = await MemberType.create({
      member_type_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true,
    });

    res.status(201).json({
      message: "Member type created successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get All Member Types
export const getMemberTypes = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await MemberType.findAndCountAll({
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
      message: "Error fetching member types",
      error: error.message,
    });
  }
};

// Get Active Member Types
export const getActiveMemberTypes = async (req, res) => {
  try {
    const data = await MemberType.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Member Type By ID
export const getMemberTypeById = async (req, res) => {
  try {
    const data = await MemberType.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Member Type
export const updateMemberType = async (req, res) => {
  try {
    const data = await MemberType.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    const { member_type_name, description, is_active } = req.body;

    data.member_type_name =
      member_type_name || data.member_type_name;
    data.description =
      description !== undefined ? description : data.description;
    data.is_active =
      is_active !== undefined ? is_active : data.is_active;

    await data.save();

    res.status(200).json({
      message: "Updated successfully",
      data,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete Member Type
export const deleteMemberType = async (req, res) => {
  try {
    const data = await MemberType.findByPk(req.params.id);

    if (!data) return res.status(404).json({ message: "Not found" });

    await data.destroy();

    res.status(200).json({ message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};