import db from "../models/index.js";
const CommunityType = db.CommunityType;

// Create Community Type
export const createCommunityType = async (req, res) => {
  try {
    const {
      community_type_name,
      description,
      is_active
    } = req.body;

    if (!community_type_name) {
      return res.status(400).json({
        message: "Community type name is required"
      });
    }

    const newCommunityType = await CommunityType.create({
      community_type_name,
      description: description || null,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      message: "Community type created successfully",
      communityType: newCommunityType
    });

  } catch (error) {
    res.status(500).json({
      message: "Error creating community type",
      error: error.message
    });
  }
};

// Get All Community Types (Pagination)
export const getCommunityTypes = async (req, res) => {
  try {
    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await CommunityType.findAndCountAll({
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
      data: rows
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching community types",
      error: error.message
    });
  }
};

// Get Active Community Types
export const getActiveCommunityTypes = async (req, res) => {
  try {
    const communityTypes = await CommunityType.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    res.status(200).json(communityTypes);

  } catch (error) {
    res.status(500).json({
      message: "Error fetching active community types",
      error: error.message,
    });
  }
};

// Get Community Type by ID
export const getCommunityTypeById = async (req, res) => {
  try {
    const { id } = req.params;

    const communityType = await CommunityType.findByPk(id);

    if (!communityType) {
      return res.status(404).json({
        message: "Community type not found"
      });
    }

    res.status(200).json(communityType);

  } catch (error) {
    res.status(500).json({
      message: "Error fetching community type",
      error: error.message
    });
  }
};

// Update Community Type
export const updateCommunityType = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      community_type_name,
      description,
      is_active
    } = req.body;

    const communityType = await CommunityType.findByPk(id);

    if (!communityType) {
      return res.status(404).json({
        message: "Community type not found"
      });
    }

    communityType.community_type_name =
      community_type_name || communityType.community_type_name;

    communityType.description =
      description !== undefined
        ? description
        : communityType.description;

    communityType.is_active =
      is_active !== undefined
        ? is_active
        : communityType.is_active;

    await communityType.save();

    res.status(200).json({
      message: "Community type updated successfully",
      communityType
    });

  } catch (error) {
    res.status(500).json({
      message: "Error updating community type",
      error: error.message
    });
  }
};

// Delete Community Type
export const deleteCommunityType = async (req, res) => {
  try {
    const { id } = req.params;

    const communityType = await CommunityType.findByPk(id);

    if (!communityType) {
      return res.status(404).json({
        message: "Community type not found"
      });
    }

    await communityType.destroy();

    res.status(200).json({
      message: "Community type deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Error deleting community type",
      error: error.message
    });
  }
};
