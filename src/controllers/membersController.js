import db from "../models/index.js";
const Member = db.Member;
import bcrypt from "bcryptjs";

export const createMember = async (req, res) => {
  try {

    const {
      member_id,
      name,
      dob,
      age,
      email,
      mobile_number,
      password,   // ⭐ ADD THIS
      community_type_id,
      blood_group,
      gender,
      profession,
      organisation,
      id_no,
      aadhar_number,
      description,
      membership_type,
      payment_status,
      payment_amount,
      transaction_id,
      membership_valid_from,
      membership_valid_till,
      is_active
    } = req.body;

    // =========================
    // Address JSON
    // =========================
    const address = {
      address_line1: req.body.address_line1,
      landmark: req.body.landmark,
      street: req.body.street,
      pincode: req.body.pincode,
      area: req.body.area,
      city: req.body.city,
      district: req.body.district,
      state: req.body.state
    };

    // =========================
    // File Handling
    // =========================
    const profile_image = req.file?.filename || null;

    // =========================
    // Validation
    // =========================
    if (!member_id || !name || !mobile_number) {
      return res.status(400).json({
        message: "Member ID, Name and Mobile Number are required"
      });
    }

    // Duplicate mobile check
    const existing = await Member.findOne({
      where: { mobile_number }
    });

    if (existing) {
      return res.status(400).json({
        message: "Mobile number already exists"
      });
    }

    // =========================
    // 🔥 PASSWORD HASHING
    // =========================
    const hashedPassword = password
      ? await bcrypt.hash(password, 10)
      : null;

    // =========================
    // Create Member
    // =========================
    const newMember = await Member.create({
      member_id,
      name,
      dob,
      age,
      email,
      mobile_number,
      password: hashedPassword, // ⭐ SAVE HASHED PASSWORD
      community_type_id,
      blood_group,
      gender,
      profession,
      organisation,
      address,
      id_no,
      aadhar_number,
      description,

      membership_type: membership_type || "free",
      payment_status: payment_status || "Pending",
      payment_amount: payment_amount || 0,
      transaction_id: transaction_id || null,
      membership_valid_from: membership_valid_from || null,
      membership_valid_till: membership_valid_till || null,

      profile_image,
      is_active: is_active !== undefined ? is_active : true
    });

    res.status(201).json({
      message: "Member created successfully",
      member: newMember
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error creating member",
      error: error.message
    });
  }
};



// ✅ GET ALL MEMBERS
export const getMembers = async (req, res) => {
  try {

    let { page = 1, limit = 10 } = req.query;

    page = Number(page);
    limit = Number(limit);

    const offset = (page - 1) * limit;

    const { count, rows } = await Member.findAndCountAll({
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
      message: "Error fetching members",
      error: error.message
    });
  }
};



// ✅ GET ACTIVE MEMBERS
export const getActiveMembers = async (req, res) => {
  try {

    const members = await Member.findAll({
      where: { is_active: true },
      order: [["id", "ASC"]],
    });

    res.status(200).json(members);

  } catch (error) {
    res.status(500).json({
      message: "Error fetching active members",
      error: error.message,
    });
  }
};



// ✅ GET MEMBER BY ID
export const getMemberById = async (req, res) => {
  try {

    const { id } = req.params;

    const member = await Member.findByPk(id);

    if (!member) {
      return res.status(404).json({
        message: "Member not found"
      });
    }

    res.status(200).json(member);

  } catch (error) {
    res.status(500).json({
      message: "Error fetching member",
      error: error.message
    });
  }
};



export const updateMember = async (req, res) => {
  try {
    const { id } = req.params;

    const member = await Member.findByPk(id);

    if (!member) {
      return res.status(404).json({
        message: "Member not found",
      });
    }

    const data = req.body;

    // =========================
    // Address JSON (same as create)
    // =========================
    const address = {
      address_line1: data.address_line1,
      landmark: data.landmark,
      street: data.street,
      pincode: data.pincode,
      area: data.area,
      city: data.city,
      district: data.district,
      state: data.state,
    };

    // =========================
    // Update normal fields
    // =========================
    Object.keys(data).forEach((key) => {
      if (
        data[key] !== undefined &&
        key !== "password" &&
        !key.startsWith("address_")
      ) {
        member[key] = data[key];
      }
    });

    // =========================
    // Address update (only if any field exists)
    // =========================
    const hasAddressUpdate = Object.values(address).some(
      (v) => v !== undefined
    );

    if (hasAddressUpdate) {
      member.address = {
        ...member.address,
        ...address,
      };
    }

    // =========================
    // Password update (ONLY if sent)
    // =========================
    if (data.password && data.password.trim() !== "") {
      const salt = await bcrypt.genSalt(10);
      member.password = await bcrypt.hash(data.password, salt);
    }
    // else → old password stays

    // =========================
    // Profile image update
    // =========================
    if (req.file?.filename) {
      member.profile_image = req.file.filename;
    }

    await member.save();

    res.status(200).json({
      message: "Member updated successfully",
      member,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Error updating member",
      error: error.message,
    });
  }
};




// ✅ DELETE MEMBER (Hard Delete - same as roles)
export const deleteMember = async (req, res) => {
  try {

    const { id } = req.params;

    const member = await Member.findByPk(id);

    if (!member) {
      return res.status(404).json({
        message: "Member not found"
      });
    }

    await member.destroy();

    res.status(200).json({
      message: "Member deleted successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Error deleting member",
      error: error.message
    });
  }
};
