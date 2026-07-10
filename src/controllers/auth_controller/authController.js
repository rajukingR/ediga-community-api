import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../models/index.js';
import { Op } from "sequelize";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../../services/pushService.js";
import { sendOTP } from "../../services/sendOTPServices.js";

const User = db.User;
const MemberType = db.MemberType;
const Category = db.Category;
const SubCategory = db.SubCategory;
const Profession = db.Profession;
const Specialization = db.Specialization;
const Notification = db.Notification;

// Helper function to calculate age from date of birth
const calculateAge = (dob) => {
  const today = new Date();
  const birthDate = new Date(dob);

  let age = today.getFullYear() - birthDate.getFullYear();

  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
};



export const sendMobileNumber = async (req, res) => {
    try {
        const { mobile } = req.body;

        if (!mobile) {
            return res.status(400).json({
                success: false,
                message: "Mobile number is required",
            });
        }

        const result = await sendOTP(mobile);

        if (!result.success) {
            return res.status(500).json(result);
        }

        return res.status(200).json({
            success: true,
            message: "OTP sent successfully",
            otp: result.otp, // Remove this in production
            sid: result.sid,
            status: result.status,
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};



// Helper function to format user response
const formatUserResponse = (user) => {
  return {
    id: user.id,
    member_id: user.member_id,
    full_name: user.full_name,
    parent_name: user.parent_name,
    member_type_id: user.member_type_id,
    category_id: user.category_id,
    sub_category_id: user.sub_category_id,
    specialization_id: user.specialization_id,
    blood_group: user.blood_group,
    dob: user.dob,
    age: user.age,
    aadhar_no: user.aadhar_no,
    voter_id_no: user.voter_id_no,
    contact_person: user.contact_person,
    organisation: user.organisation,
    profession_id: user.profession_id,
    address: user.address,
    booth_no: user.booth_no,
    pin_code: user.pin_code,
    city: user.city,
    district: user.district,
    state: user.state,
    ls_sabha_mp: user.ls_sabha_mp,
    ls_code: user.ls_code,
    vs_sabha_mla: user.vs_sabha_mla,
    vs_code: user.vs_code,
    panchayat: user.panchayat,
    ward: user.ward,
    mobile1: user.mobile1,
    mobile2: user.mobile2,
    other_phone: user.other_phone,
    phone1_office: user.phone1_office,
    phone2_office: user.phone2_office,
    phone_residence: user.phone_residence,
    email1: user.email1,
    email2: user.email2,
    password: user.password,
    website: user.website,
    remark: user.remark,
    document_file: user.document_file,
    voter_document_file: user.voter_document_file,
    aadhar_document_file: user.aadhar_document_file,
    member_photo: user.member_photo,
    is_active: user.is_active,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
};

// =========================
// SIGNUP / REGISTRATION
// =========================
export const signup = async (req, res) => {
  try {
    const {
      full_name,
      parent_name,
      member_type_id,
      category_id,
      sub_category_id,
      specialization_id,
      blood_group,
      dob,
      age,
      aadhar_no,
      voter_id_no,
      contact_person,
      organisation,
      profession_id,
      address,
      booth_no,
      pin_code,
      city,
      district,
      state,
      ls_sabha_mp,
      ls_code,
      vs_sabha_mla,
      vs_code,
      panchayat,
      ward,
      mobile1,
      mobile2,
      other_phone,
      phone1_office,
      phone2_office,
      phone_residence,
      email1,
      email2,
      website,
      password,
      remark
    } = req.body;

    // Validation
    if (!full_name || !email1 || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ where: { email1 } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Check mobile
    if (mobile1) {
      const existingMobile = await User.findOne({ where: { mobile1 } });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already registered",
        });
      }
    }

    let status = "Pending";
    let notificationsData = [];

    // Get all admins for notification (users with member_type_id = 1 for admin)
    const admins = await User.findAll({
      where: { member_id: "ADM123456789", status: "Approved", is_active: true }
    });

    // Prepare notifications for all admins
    for (const admin of admins) {
      notificationsData.push({
        user_id: admin.id,
        message: `${full_name} registered as a new member. Please review and approve.`,
        user_type: 'admin',
        recipient_name: admin.full_name,
        push_title: "🔔 New Member Registration",
        push_body: `${full_name} registered as a new member. Please review and approve.`
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Handle file uploads
    const document_file = req.files?.document_file?.[0]?.filename || null;
    const member_photo = req.files?.member_photo?.[0]?.filename || null;
    const aadhar_document_file = req.files?.aadhar_document_file?.[0]?.filename || null;
    const voter_document_file = req.files?.voter_document_file?.[0]?.filename || null;

    // Parse address
    let parsedAddress = address;
    if (typeof address === "string") {
      try {
        parsedAddress = JSON.parse(address);
      } catch (err) {
        parsedAddress = null;
      }
    }

    // Generate member_id if not provided
    const finalMemberId = `MEM${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Calculate age if dob provided but age not
    const finalAge = age || (dob ? calculateAge(dob) : null);

    // Create user
    const newUser = await User.create({
      member_id: finalMemberId,
      full_name,
      parent_name,
      member_type_id: member_type_id || null,
      category_id: category_id || null,
      sub_category_id: sub_category_id || null,
      specialization_id: specialization_id || null,
      blood_group: blood_group || null,
      dob: dob || null,
      age: finalAge,
      aadhar_no: aadhar_no || null,
      voter_id_no: voter_id_no || null,
      contact_person: contact_person || null,
      organisation: organisation || null,
      profession_id: profession_id || null,
      address: parsedAddress,
      booth_no: booth_no || null,
      pin_code: pin_code || null,
      city: city || null,
      district: district || null,
      state: state || null,
      ls_sabha_mp: ls_sabha_mp || null,
      ls_code: ls_code || null,
      vs_sabha_mla: vs_sabha_mla || null,
      vs_code: vs_code || null,
      panchayat: panchayat || null,
      ward: ward || null,
      mobile1: mobile1 || null,
      mobile2: mobile2 || null,
      other_phone: other_phone || null,
      phone1_office: phone1_office || null,
      phone2_office: phone2_office || null,
      phone_residence: phone_residence || null,
      email1: email1,
      email2: email2 || null,
      website: website || null,
      password: hashedPassword,
      status: status,
      is_active: false,
      remark: remark || null,
      document_file: document_file,
      member_photo: member_photo,
      aadhar_document_file: aadhar_document_file,
      voter_document_file: voter_document_file,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Send notifications to admins
    if (notificationsData.length > 0) {
      const notifications = notificationsData.map(notification => ({
        user_id: notification.user_id,
        message: notification.message,
        is_read: 0,
        message_type: "member_request",
        detail: JSON.stringify({
          member_id: newUser.id,
          member_name: newUser.full_name,
          created_by: 'Website Self-Registration',
          created_by_id: null,
          mobile_number: newUser.mobile1,
          email: newUser.email1,
          created_at: newUser.created_at,
          registration_source: 'website'
        }),
        photo: "bell-icon.webp"
      }));

      await Notification.bulkCreate(notifications);

      // Push notifications to admins (non-blocking)
      const pushPromises = notificationsData.map(async (notification) => {
        try {
          const result = await sendPushToUser({
            userId: notification.user_id,
            title: notification.push_title || "🔔 New Member Registration",
            body: notification.push_body,
            click_action: "https://edigacommunity.innogenx.co.in/dashboard/approvals",
            icon: "https://edigacommunity.innogenx.co.in/logo.webp",
            data: {
              type: "member_approval_request",
              member_id: String(newUser.id),
              member_name: String(newUser.full_name),
              requested_by: 'Website Registration',
              registration_source: 'website',
              timestamp: String(new Date().toISOString())
            }
          });
          return result;
        } catch (error) {
          console.error(`❌ Push error for admin ${notification.user_id}:`, error.message);
          return { success: false, error: error.message };
        }
      });

      Promise.allSettled(pushPromises);
    }

    return res.status(201).json({
      success: true,
      message: `Thank you for registering. Your application has been submitted and is pending admin approval.`,
      user: formatUserResponse(newUser),
      needs_approval: true,
      notifications_sent: notificationsData.length
    });

  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      message: "Signup failed",
      error: error.message,
    });
  }
};

// =========================
// SIGNIN / LOGIN WITH EMAIL/PASS       
// =========================
// export const signin = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     if (!email || !password) {
//       return res.status(400).json({
//         success: false,
//         message: "Email and password are required"
//       });
//     }

//     const user = await User.findOne({ where: { email1: email } });

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials"
//       });
//     }

//     // Check if user is active
//     if (!user.is_active) {
//       return res.status(403).json({
//         success: false,
//         message: "Your account is inactive. Please contact admin.",
//       });
//     }

//     // Check status (Pending/Approved/Rejected)
//     if (user.status === "Rejected") {
//       return res.status(403).json({
//         success: false,
//         message: "Your registration has been rejected. Please contact admin.",
//       });
//     }

//     if (user.status === "Pending") {
//       return res.status(403).json({
//         success: false,
//         message: "Your account is pending approval. Please wait for admin verification.",
//       });
//     }

//     // Verify password
//     const passwordMatch = await bcrypt.compare(password, user.password);

//     if (!passwordMatch) {
//       return res.status(401).json({
//         success: false,
//         message: "Invalid credentials"
//       });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       {
//         id: user.id,
//         email: user.email1,
//         full_name: user.full_name,
//         member_type_id: user.member_type_id,
//         status: user.status
//       },
//       process.env.JWT_SECRET,
//       { expiresIn: "24h" }
//     );

//     res.status(200).json({
//       success: true,
//       message: "Signin successful",
//       token,
//       user: {
//         id: user.id,
//         full_name: user.full_name,
//         member_type_id: user.member_type_id,
//         email1: user.email1,
//         mobile1: user.mobile1,
//         address: user.address,
//         member_photo: user.member_photo,
//         status: user.status,
//         is_active: user.is_active,
//         created_at: user.created_at
//       },
//     });
//   } catch (error) {
//     console.error("Signin error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error signing in",
//       error: error.message,
//     });
//   }
// };



// =========================
// SIGNIN / LOGIN MOBILE/PASS
// =========================
export const signin = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    // Validate input
    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Password is required"
      });
    }

    if (!mobile) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required"
      });
    }

    // Find user by mobile number
    let user = null;

    if (mobile) {
      // Clean mobile number - remove spaces, special characters
      const cleanMobile = mobile.replace(/[^0-9]/g, '');

      // Try to find by mobile1 (primary) or mobile2 (alternate)
      user = await User.findOne({
        where: {
          mobile1: cleanMobile
        }
      });

      // If not found, try mobile2
      if (!user) {
        user = await User.findOne({
          where: {
            mobile2: cleanMobile
          }
        });
      }
    }

    // If user not found by mobile, try email (for backward compatibility)
    if (!user && mobile && mobile.includes('@')) {
      user = await User.findOne({
        where: {
          email1: mobile.toLowerCase()
        }
      });
    }

    // If still no user found, return error
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. User not found with this mobile number or email."
      });
    }

    // ==========================================
    // ACCOUNT VALIDATION
    // ==========================================

    // 1. Check for Rejected status
    if (user.status === "Rejected") {
      return res.status(403).json({
        success: false,
        message: "Your registration has been rejected. Please contact admin for assistance.",
        code: "ACCOUNT_REJECTED"
      });
    }

    // 2. Check for Pending status
    if (user.status === "Pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin verification.",
        code: "ACCOUNT_PENDING"
      });
    }

    // 3. Check for Approved status
    if (user.status === "Approved") {
      // 3a. Check is_active
      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact admin.",
          code: "ACCOUNT_INACTIVE"
        });
      }

      // 3b. Check member_type_id
      // Admin: member_type_id = null (allowed)
      // Members: member_type_id must be in active member_types
      
      if (user.member_type_id === null) {
        // ✅ Admin - allowed to login
        // Proceed to password verification
      } else {
        // Member - check if member_type_id is active
        const activeMemberTypes = await MemberType.findAll({
          // where: {
          //   is_active: true
          // },
          attributes: ['id'],
          raw: true
        });

        const activeMemberTypeIds = activeMemberTypes.map(mt => mt.id);

        if (!activeMemberTypeIds.includes(user.member_type_id)) {
          // member_type_id is not active or doesn't exist
          if (user.member_type_id === 0) {
            return res.status(403).json({
              success: false,
              message: "Your account is inactive. Please contact admin to reactivate your account.",
              code: "ACCOUNT_INACTIVE"
            });
          }

          return res.status(403).json({
            success: false,
            message: "Your account registration is incomplete. Please complete your profile or contact admin.",
            code: "INCOMPLETE_REGISTRATION"
          });
        }
        // ✅ Member with active member_type - allowed to login
      }
    } else {
      // Catch any other status
      return res.status(403).json({
        success: false,
        message: "Invalid account status. Please contact admin.",
        code: "INVALID_STATUS"
      });
    }

    // ==========================================
    // ALL CHECKS PASSED - PROCEED WITH LOGIN
    // ==========================================

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please check your password."
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email1,
        mobile: user.mobile1,
        full_name: user.full_name,
        member_type_id: user.member_type_id,
        status: user.status,
        is_active: user.is_active
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Return success response
    res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        member_type_id: user.member_type_id,
        email1: user.email1,
        mobile1: user.mobile1,
        mobile2: user.mobile2,
        address: user.address,
        member_photo: user.member_photo,
        status: user.status,
        is_active: user.is_active,
        created_at: user.created_at
      },
    });
  } catch (error) {
    console.error("Signin error:", error);
    res.status(500).json({
      success: false,
      message: "Error signing in",
      error: error.message,
    });
  }
};

// =========================
// GET ALL USERS
// =========================
export const getAllUsers = async (req, res) => {
  try {
    const {
      district,
      member_type_id,
      search,
    } = req.query;

    const whereConditions = {
      status: "Approved",
      is_active: true,
    };

    // District – partial match
    if (district && district.trim() !== "") {
      whereConditions.district = { [Op.like]: `%${district}%` };
    }

    // Member Type – support multiple values
    if (member_type_id && member_type_id.trim() !== "" && member_type_id !== "all") {
      let typesArray = [];
      if (member_type_id.includes(",")) {
        typesArray = member_type_id.split(",").map(t => t.trim());
      } else {
        typesArray = [member_type_id.trim()];
      }
      typesArray = typesArray.filter(t => t !== "");

      if (typesArray.length > 0) {
        whereConditions.member_type_id = { [Op.in]: typesArray };
      }
    }

    // Search by name or mobile
    if (search && search.trim() !== "") {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { mobile1: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: 'memberType', // ✅ CORRECTED: Use 'memberType' (matches the alias in User model)
          attributes: ['id', 'member_type_name'], // ✅ CORRECTED: Use 'member_type_name' (matches MemberType model)
          required: false
        },
        {
          model: Category,
          as: 'category',
          attributes: ['id', 'category_name'],
          required: false
        }
      ],
      order: [["full_name", "ASC"]],
    });

    const formattedUsers = users.map(formatUserResponse);

    return res.status(200).json({
      success: true,
      total: formattedUsers.length,
      data: formattedUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching users",
      error: error.message,
    });
  }
};

// =========================
// GET ALL PENDING USERS
// =========================
export const getAllPendingUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      member_type_id,
      search
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const loginUserId = req.user.id;

    // Base condition
    const whereConditions = {
      status: "Pending"
    };



    // Member Type filter
    if (member_type_id && member_type_id.trim() !== "") {
      let typesArray = member_type_id.split(",").map(t => t.trim()).filter(t => t !== "");
      if (typesArray.length > 0) {
        whereConditions.member_type_id = { [Op.in]: typesArray };
      }
    }

    // Search
    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { mobile1: { [Op.like]: `%${search}%` } },
        { profession_id: { [Op.like]: `%${search}%` } },
        { organisation: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
          required: false,
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
          required: false,
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
          required: false,
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: {
        exclude: ["password"],
      },
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parent_name: user.parent_name,
      member_type_id: user.member_type_id,
      member_type_name: user.memberType ? user.memberType.member_type_name : null, // ✅ CORRECTED
      category_id: user.category_id,
      category_name: user.category?.category_name || null,

      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name:
        user.specialization?.specialization_name || null,
      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,
      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,
      contact_person: user.contact_person,
      organisation: user.organisation,
      profession_id: user.profession_id,
      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,
      city: user.city,
      district: user.district,
      state: user.state,
      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,
      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,
      panchayat: user.panchayat,
      ward: user.ward,
      mobile1: user.mobile1,
      mobile2: user.mobile2,
      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,
      email1: user.email1,
      email2: user.email2,
      website: user.website,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      member_photo: user.member_photo,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });

  } catch (error) {
    console.error("Error fetching pending users:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching pending users",
      error: error.message,
    });
  }
};


// =========================
// GET ALL REJECTED USERS
// =========================
export const getAllRejectedUsers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      member_type_id,
      search
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const loginUserId = req.user.id;

    // Base condition - status is Rejected
    const whereConditions = {
      status: "Rejected"
    };

    // Member Type filter
    if (member_type_id && member_type_id.trim() !== "") {
      let typesArray = member_type_id.split(",").map(t => t.trim()).filter(t => t !== "");
      if (typesArray.length > 0) {
        whereConditions.member_type_id = { [Op.in]: typesArray };
      }
    }

    // Search
    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { mobile1: { [Op.like]: `%${search}%` } },
        { profession_id: { [Op.like]: `%${search}%` } },
        { organisation: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
          required: false,
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
          required: false,
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
          required: false,
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: {
        exclude: ["password"],
      },
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parent_name: user.parent_name,
      member_type_id: user.member_type_id,
      member_type_name: user.memberType ? user.memberType.member_type_name : null,
      category_id: user.category_id,
      category_name: user.category?.category_name || null,
      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,
      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,
      specialization_id: user.specialization_id,
      specialization_name: user.specialization?.specialization_name || null,
      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,
      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,
      contact_person: user.contact_person,
      organisation: user.organisation,
      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,
      city: user.city,
      district: user.district,
      state: user.state,
      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,
      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,
      panchayat: user.panchayat,
      ward: user.ward,
      mobile1: user.mobile1,
      mobile2: user.mobile2,
      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,
      email1: user.email1,
      email2: user.email2,
      website: user.website,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      member_photo: user.member_photo,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });

  } catch (error) {
    console.error("Error fetching rejected users:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching rejected users",
      error: error.message,
    });
  }
};

// =========================
// GET ALL APPROVED MEMBERS
// =========================
// =========================
// GET ALL APPROVED MEMBERS
// =========================
export const getAllMembers = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 10,
      member_type_id,
      search,
    } = req.query;

    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    const offset = (page - 1) * limit;

    const whereConditions = {
      status: "Approved",
      is_active: true,
      member_type_id: {
        [Op.ne]: null,
      },
    };

    // Filter by member_type_id (supports: 1 or 1,2,3)
    if (member_type_id && member_type_id.trim() !== "") {
      const memberTypeIds = member_type_id
        .split(",")
        .map((id) => parseInt(id.trim(), 10))
        .filter((id) => !isNaN(id));

      if (memberTypeIds.length > 0) {
        whereConditions.member_type_id = {
          [Op.in]: memberTypeIds,
        };
      }
    }

    // Search
    if (search && search.trim() !== "") {
      whereConditions[Op.or] = [
        { member_id: { [Op.like]: `%${search}%` } },
        { full_name: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { mobile1: { [Op.like]: `%${search}%` } },
        { organisation: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { district: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],
      attributes: {
        exclude: ["password"],
      },
      order: [["updated_at", "DESC"]],
      limit,
      offset,
      distinct: true,
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      title_name: user.title_name,
      full_name: user.full_name,
      parent_name: user.parent_name,
      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,
      category_id: user.category_id,
      category_name: user.category?.category_name || null,
      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,
      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,
      specialization_id: user.specialization_id,
      specialization_name: user.specialization?.specialization_name || null,
      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,
      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,
      contact_person: user.contact_person,
      organisation: user.organisation,
      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,
      city: user.city,
      district: user.district,
      state: user.state,
      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,
      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,
      panchayat: user.panchayat,
      ward: user.ward,
      mobile1: user.mobile1,
      mobile2: user.mobile2,
      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,

      email1: user.email1,
      email2: user.email2,
      website: user.website,

      status: user.status,
      is_active: user.is_active,
      remark: user.remark,

      document_file: user.document_file,
      member_photo: user.member_photo,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,

      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching members:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching members",
      error: error.message,
    });
  }
};

// =========================
// GET ACTIVE USERS
// =========================
export const getActiveUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_active: true,
        status: "Approved",
        member_type_id: 1,
      },
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],

      order: [["full_name", "ASC"]],
    });

    const formatted = users.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      full_name: user.full_name,
      parent_name: user.parent_name,
      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,

      category_id: user.category_id,
      category_name: user.category?.category_name || null,

      sub_category_id: user.sub_category_id,
      sub_category_name:
        user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name:
        user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name:
        user.specialization?.specialization_name || null,
      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,
      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,
      contact_person: user.contact_person,
      organisation: user.organisation,
      profession_id: user.profession_id,
      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,
      city: user.city,
      district: user.district,
      state: user.state,
      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,
      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,
      panchayat: user.panchayat,
      ward: user.ward,
      mobile1: user.mobile1,
      mobile2: user.mobile2,
      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,
      email1: user.email1,
      email2: user.email2,
      website: user.website,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      member_photo: user.member_photo,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching active users:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching active users",
      error: error.message,
    });
  }
};

// =========================
// GET USER BY ID
// =========================
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const formattedUser = formatUserResponse(user);

    // Add related names
    formattedUser.member_type_name =
      user.memberType?.member_type_name || null;

    formattedUser.category_name =
      user.category?.category_name || null;

    formattedUser.sub_category_name =
      user.sub_category?.sub_category_name || null;

    formattedUser.profession_name =
      user.profession?.profession_name || null;

    formattedUser.specialization_name =
      user.specialization?.specialization_name || null;

    return res.status(200).json({
      success: true,
      data: formattedUser,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message,
    });
  }
};

// =========================
// UPDATE USER
// =========================
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateData = { ...req.body };

    // Prevent member_id update
    delete updateData.member_id;

    // Parse address JSON
    if (updateData.address && typeof updateData.address === "string") {
      try {
        updateData.address = JSON.parse(updateData.address);
      } catch (error) {
        console.error("Error parsing address:", error);
        updateData.address = {};
      }
    }

    // Auto is_active handling based on status
    if (updateData.status !== undefined) {
      if (updateData.status === "Approved") {
        updateData.is_active = true;
      } else {
        updateData.is_active = false;
      }
    }
    // Password update
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password;
    }

    // File uploads
    if (req.files) {
      if (req.files.document_file) {
        updateData.document_file = req.files.document_file[0].filename;
      }
      if (req.files.member_photo) {
        updateData.member_photo = req.files.member_photo[0].filename;
      }
      if (req.files.aadhar_document_file) {
        updateData.aadhar_document_file = req.files.aadhar_document_file[0].filename;
      }
      if (req.files.voter_document_file) {
        updateData.voter_document_file = req.files.voter_document_file[0].filename;
      }
    }

    // Auto calculate age
    if (updateData.dob && !updateData.age) {
      updateData.age = calculateAge(updateData.dob);
    }

    updateData.updated_at = new Date();

    await user.update(updateData);

    const updatedUser = await User.findByPk(id);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error("Error updating user:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating user",
      error: error.message,
    });
  }
};

// =========================
// UPDATE USER STATUS (Approve/Reject)
// =========================
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remark, member_type_id } = req.body;

    // Validate status
    if (!status || !["Pending", "Approved", "Rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status (Pending/Approved/Rejected) is required",
      });
    }

    // Find user
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate member type (optional)
    if (member_type_id) {
      const memberType = await MemberType.findByPk(member_type_id);

      if (!memberType) {
        return res.status(400).json({
          success: false,
          message: "Invalid member type.",
        });
      }
    }

    // Update data
    const updateData = {
      status,
      member_type_id: member_type_id ?? user.member_type_id,
      is_active: status === "Approved",
      remark: remark || user.remark,
      updated_at: new Date(),
    };

    await user.update(updateData);

    // Notification message
    let notificationMessage = "";
    let emailSubject = "";
    let emailHtml = "";

    if (status === "Approved") {
      notificationMessage = `Dear ${user.full_name}, Great news! Your registration request has been APPROVED. You can now login to your account using your registered email and password.`;

      emailSubject = "🎉 Registration Approved - Welcome!";
      emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif">
        <h2>Account Approved! 🎉</h2>
        <p>Dear <b>${user.full_name}</b>,</p>
        <p>Your registration request has been <b>APPROVED</b>.</p>
        <p>You can now login using your registered email and password.</p>
        <p>
          <a href="https://edigacommunity.innogenx.co.in/login">
            Login Now
          </a>
        </p>
        <p>Regards,<br>Ediga Community Team</p>
      </body>
      </html>
      `;
    } else if (status === "Rejected") {
      notificationMessage = `Dear ${user.full_name}, Your registration request has been rejected.${remark ? ` Reason: ${remark}` : ""}`;

      emailSubject = "Registration Status Update";

      emailHtml = `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Arial,sans-serif">
        <h2>Registration Rejected</h2>
        <p>Dear <b>${user.full_name}</b>,</p>
        <p>Your registration request has been <b>REJECTED</b>.</p>

        ${remark
          ? `<p><b>Reason:</b> ${remark}</p>`
          : ""
        }

        <p>Please contact support for more details.</p>

        <p>Regards,<br>Ediga Community Team</p>
      </body>
      </html>
      `;
    }

    // Create notification
    await Notification.create({
      user_id: user.id,
      message: notificationMessage,
      message_type:
        status === "Approved"
          ? "registration_approved"
          : "registration_rejected",
      is_read: 0,
      detail: {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email1,
        member_type_id: updateData.member_type_id,
        status,
        remark: remark || "",
        login_url: "https://edigacommunity.innogenx.co.in/login",
      },
      photo: "bell-icon.webp",
    });

    // Send email
    if (emailSubject && emailHtml && user.email1) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
          to: user.email1,
          subject: emailSubject,
          html: emailHtml,
        });
      } catch (emailError) {
        console.error("Email Error:", emailError);
      }
    }

    return res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      data: {
        id: user.id,
        full_name: user.full_name,
        email1: user.email1,
        member_type_id: updateData.member_type_id,
        status: updateData.status,
        is_active: updateData.is_active,
        remark: updateData.remark,
      },
    });
  } catch (error) {
    console.error("Error updating user status:", error);

    return res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message,
    });
  }
};

// =========================
// DELETE USER
// =========================
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    await user.destroy();

    res.status(200).json({
      success: true,
      message: "User deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting user",
      error: error.message
    });
  }
};

// =========================
// SEND RESET PASSWORD LINK
// =========================
export const sendResetPasswordLink = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const user = await User.findOne({ where: { email1: email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    await user.update({
      reset_token: resetToken,
      reset_token_expiry: expiryTime
    });

    const resetURL = `${process.env.DOMAIN_URL}/reset-password/${resetToken}`;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Link",
      html: `
        <p>Hello ${user.full_name},</p>
        <p>Click the link below to reset your password (Valid for 10 minutes):</p>
        <a href="${resetURL}">${resetURL}</a>
      `
    });

    res.status(200).json({
      success: true,
      message: "Reset password link sent successfully"
    });
  } catch (error) {
    console.error("Error sending reset link:", error);
    res.status(500).json({
      success: false,
      message: "Error sending reset link",
      error: error.message
    });
  }
};

// // =========================
// // RESET PASSWORD
// // =========================
// export const resetPassword = async (req, res) => {
//   try {
//     const { token, new_password } = req.body;

//     if (!token || !new_password) {
//       return res.status(400).json({
//         success: false,
//         message: "Token and new password required"
//       });
//     }

//     const user = await User.findOne({
//       where: {
//         reset_token: token,
//         reset_token_expiry: {
//           [Op.gt]: new Date()
//         }
//       }
//     });

//     if (!user) {
//       return res.status(400).json({
//         success: false,
//         message: "Token invalid or expired"
//       });
//     }

//     const hashedPassword = await bcrypt.hash(new_password, 10);

//     await user.update({
//       password: hashedPassword,
//       reset_token: null,
//       reset_token_expiry: null,
//       updated_at: new Date()
//     });

//     res.status(200).json({
//       success: true,
//       message: "Password updated successfully"
//     });
//   } catch (error) {
//     console.error("Error resetting password:", error);
//     res.status(500).json({
//       success: false,
//       message: "Error resetting password",
//       error: error.message
//     });
//   }
// };

// =========================
// CHECK RESET TOKEN
// =========================
export const checkResetToken = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({
      where: {
        reset_token: token,
        reset_token_expiry: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Token valid"
    });
  } catch (err) {
    console.error("Error checking token:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message
    });
  }
};

// =========================
// SEND EMAIL OTP
// =========================
export const sendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address"
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ where: { email1: email } });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered. Please login or use a different email address."
      });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in memory
    if (!global.otpStore) {
      global.otpStore = new Map();
    }

    global.otpStore.set(email, {
      otp: otp,
      expiry: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });

    // Setup email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Verify Your Email - New Member Registration",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">Welcome to Our Community!</h2>
          <p>Thank you for registering as a new member.</p>
          <p>Your OTP for email verification is:</p>
          <div style="background-color: #f0f0f0; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 5px; border-radius: 8px;">
            ${otp}
          </div>
          <p>This OTP will expire in <strong>5 minutes</strong>.</p>
          <hr />
          <p style="color: #666; font-size: 12px;">This is an automated message, please do not reply to this email.</p>
        </div>
      `
    });

    setTimeout(() => {
      if (global.otpStore && global.otpStore.has(email)) {
        const stored = global.otpStore.get(email);
        if (Date.now() > stored.expiry) {
          global.otpStore.delete(email);
        }
      }
    }, 5 * 60 * 1000);

    res.status(200).json({
      success: true,
      message: "OTP sent successfully. Please verify your email to complete registration."
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Error sending OTP",
      error: error.message
    });
  }
};

// =========================
// VERIFY EMAIL OTP
// =========================
export const verifyEmailOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required"
      });
    }

    if (!global.otpStore || !global.otpStore.has(email)) {
      return res.status(400).json({
        success: false,
        message: "No OTP found. Please request a new OTP"
      });
    }

    const storedData = global.otpStore.get(email);

    if (Date.now() > storedData.expiry) {
      global.otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new OTP"
      });
    }

    if (storedData.attempts >= 5) {
      global.otpStore.delete(email);
      return res.status(400).json({
        success: false,
        message: "Too many failed attempts. Please request a new OTP"
      });
    }

    if (storedData.otp !== otp) {
      storedData.attempts++;
      global.otpStore.set(email, storedData);

      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${5 - storedData.attempts} attempts remaining`
      });
    }

    global.otpStore.delete(email);

    res.status(200).json({
      success: true,
      message: "Email verified successfully! You can now complete your registration.",
      email: email,
      isVerified: true
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: error.message
    });
  }
};

// =========================
// RESEND EMAIL OTP
// =========================
export const resendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    const existingUser = await User.findOne({ where: { email1: email } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered. Please login."
      });
    }

    if (global.otpStore && global.otpStore.has(email)) {
      global.otpStore.delete(email);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    if (!global.otpStore) {
      global.otpStore = new Map();
    }

    global.otpStore.set(email, {
      otp: otp,
      expiry: Date.now() + 5 * 60 * 1000,
      attempts: 0
    });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "New OTP - Email Verification",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #f97316;">New Verification Code</h2>
          <p>Your new OTP for email verification is:</p>
          <div style="background-color: #f0f0f0; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 5px; border-radius: 8px;">
            ${otp}
          </div>
          <p>This OTP will expire in <strong>5 minutes</strong>.</p>
        </div>
      `
    });

    res.status(200).json({
      success: true,
      message: "New OTP sent successfully"
    });
  } catch (error) {
    console.error("Error resending OTP:", error);
    res.status(500).json({
      success: false,
      message: "Error resending OTP",
      error: error.message
    });
  }
};

// =========================
// GET USER STATISTICS
// =========================
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const approvedUsers = await User.count({ where: { status: 'Approved' } });
    const pendingUsers = await User.count({ where: { status: 'Pending' } });
    const rejectedUsers = await User.count({ where: { status: 'Rejected' } });
    const activeUsers = await User.count({ where: { is_active: true } });

    // Count by member type
    const memberTypeStats = await User.findAll({
      attributes: ['member_type_id', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { member_type_id: { [Op.ne]: null } },
      group: ['member_type_id'],
      include: [
        {
          model: MemberType,
          as: 'memberType', // ✅ CORRECTED: Use 'memberType' (matches the alias in User model)
          attributes: ['id', 'member_type_name'], // ✅ CORRECTED: Use 'member_type_name' (matches MemberType model)
          required: false
        }
      ]
    });

    // Count by district
    const districtStats = await User.findAll({
      attributes: ['district', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { district: { [Op.ne]: null } },
      group: ['district']
    });

    // Count by booth
    const boothStats = await User.findAll({
      attributes: ['booth_no', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: { booth_no: { [Op.ne]: null } },
      group: ['booth_no']
    });

    res.status(200).json({
      success: true,
      data: {
        total: totalUsers,
        approved: approvedUsers,
        pending: pendingUsers,
        rejected: rejectedUsers,
        active: activeUsers,
        by_member_type: memberTypeStats,
        by_district: districtStats,
        by_booth: boothStats
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
      error: error.message
    });
  }
};



// =========================
// GET ALL VOLUNTEER MEMBERS
// =========================
export const getAllVolunteerMembers = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const whereConditions = {
      is_active: true,
      status: 'Approved',
      member_type_id: 3 // Assuming volunteer_member has member_type_id = 2
    };

    if (is_active !== undefined) {
      whereConditions.is_active = is_active === 'true';
    }

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { profession_id: { [Op.like]: `%${search}%` } },
        { organisation: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      full_name: user.full_name,
      parent_name: user.parent_name,

      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,

      category_id: user.category_id,
      category_name: user.category?.category_name || null,

      sub_category_id: user.sub_category_id,
      sub_category_name:
        user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name:
        user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name:
        user.specialization?.specialization_name || null,

      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,

      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,

      contact_person: user.contact_person,
      organisation: user.organisation,

      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,

      city: user.city,
      district: user.district,
      state: user.state,

      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,

      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,

      panchayat: user.panchayat,
      ward: user.ward,

      mobile1: user.mobile1,
      mobile2: user.mobile2,

      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,

      email1: user.email1,
      email2: user.email2,
      website: user.website,

      status: user.status,
      is_active: user.is_active,
      remark: user.remark,

      member_photo: user.member_photo,
      document_file: user.document_file,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,

      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching volunteer members:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching volunteer members",
      error: error.message,
    });
  }
};

// =========================
// GET ALL PROFESSIONAL VOLUNTEERS
// =========================
export const getAllProfessionalVolunteers = async (req, res) => {
  try {
    let { page = 1, limit = 10, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const whereConditions = {
      status: "Approved",
      member_type_id: 2, // professional_volunteer
    };

    if (is_active !== undefined) {
      whereConditions.is_active = is_active === "true";
    }

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email1: { [Op.like]: `%${search}%` } },
        { organisation: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,

      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
          required: false,
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name"],
          required: false,
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
          required: false,
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
          required: false,
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
          required: false,
        },
      ],

      attributes: {
        exclude: ["password"],
      },

      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    const data = rows.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      full_name: user.full_name,
      parent_name: user.parent_name,

      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,

      category_id: user.category_id,
      category_name: user.category?.category_name || null,

      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name:
        user.specialization?.specialization_name || null,

      organisation: user.organisation,
      mobile1: user.mobile1,
      email1: user.email1,
      address: user.address,
      city: user.city,
      district: user.district,
      state: user.state,

      status: user.status,
      is_active: user.is_active,

      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      data,
    });
  } catch (error) {
    console.error("Error fetching professional volunteers:", error);

    return res.status(500).json({
      success: false,
      message: "Error fetching professional volunteers",
      error: error.message,
    });
  }
};


// =========================
// GET ACTIVE PROFESSIONAL VOLUNTEERS (with issue type filtering)
// =========================
// export const getActiveProfessionalVolunteers = async (req, res) => {
//   try {
//     let {
//       issue_type,
//       category,
//       location,
//       search,
//       min_experience,
//       max_experience,
//     } = req.query;

//     // Handle issue_type if array
//     if (Array.isArray(issue_type)) {
//       const uniqueIssues = [...new Set(issue_type.filter(Boolean))];
//       issue_type = uniqueIssues[0] || null;
//     }

//     // Base conditions
//     const whereConditions = {
//       is_active: true,
//       status: "Approved",
//       member_type_id: 2, // professional_volunteer
//     };

//     // issue_type is mandatory
//     if (!issue_type || !issue_type.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "issue_type is required",
//         data: [],
//       });
//     }

//     // Category Mapping
//     const categoryMapping = {
//       "Medical Facility": [1, 2, 3],
//       "Medical Camp": [1, 2, 4],
//       Healthcare: [1, 2, 3, 4],
//       "Legal Aid": [5, 6, 7],
//       "Legal Awareness": [5, 6, 7],
//       Education: [8, 9, 10],
//       "Digital Literacy": [11, 12, 13],
//       "Financial Literacy": [14, 15, 16],
//       Housing: [17, 18, 19],
//       "Women Empowerment": [20, 21, 22],
//       "Senior Citizens": [23, 24, 25],
//       Environment: [26, 27, 28],
//       "Business Development": [29, 30, 31],
//       Agriculture: [32, 33, 34],
//       "Community Service": [35, 36, 37],
//       Infrastructure: [38, 39, 40],
//       "Public Safety": [41, 42, 43],
//       "Blood Donation": [1, 2, 44],
//     };

//     const allowedCategories = categoryMapping[issue_type] || [];

//     if (allowedCategories.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid issue_type",
//         data: [],
//       });
//     }

//     whereConditions.category_id = {
//       [Op.in]: allowedCategories,
//     };

//     // Location Filter
//     if (location) {
//       const locationFilter = {
//         [Op.or]: [
//           { city: { [Op.like]: `%${location}%` } },
//           { district: { [Op.like]: `%${location}%` } },
//           { state: { [Op.like]: `%${location}%` } },
//         ],
//       };

//       whereConditions[Op.and] = whereConditions[Op.and] || [];
//       whereConditions[Op.and].push(locationFilter);
//     }

//     // Search Filter
//     if (search) {
//       const searchFilter = {
//         [Op.or]: [
//           { full_name: { [Op.like]: `%${search}%` } },
//           { email1: { [Op.like]: `%${search}%` } },
//           { mobile1: { [Op.like]: `%${search}%` } },
//           { organisation: { [Op.like]: `%${search}%` } },
//         ],
//       };

//       whereConditions[Op.and] = whereConditions[Op.and] || [];
//       whereConditions[Op.and].push(searchFilter);
//     }

//     const users = await User.findAll({
//       where: whereConditions,

//       include: [
//         {
//           model: MemberType,
//           as: "memberType",
//           attributes: ["id", "member_type_name"],
//         },
//         {
//           model: Category,
//           as: "category",
//           attributes: ["id", "category_name"],
//         },
//         {
//           model: SubCategory,
//           as: "sub_category",
//           attributes: ["id", "sub_category_name"],
//         },
//         {
//           model: Profession,
//           as: "profession",
//           attributes: ["id", "profession_name"],
//         },
//         {
//           model: Specialization,
//           as: "specialization",
//           attributes: ["id", "specialization_name"],
//         },
//       ],

//       order: [["full_name", "ASC"]],
//       attributes: {
//         exclude: ["password"],
//       },
//     });

//     const formatted = users.map((user) => ({
//       id: user.id,
//       member_id: user.member_id,
//       full_name: user.full_name,
//       parent_name: user.parent_name,

//       member_type_id: user.member_type_id,
//       member_type_name: user.memberType?.member_type_name || null,

//       category_id: user.category_id,
//       category_name: user.category?.category_name || null,

//       sub_category_id: user.sub_category_id,
//       sub_category_name:
//         user.sub_category?.sub_category_name || null,

//       profession_id: user.profession_id,
//       profession_name:
//         user.profession?.profession_name || null,

//       specialization_id: user.specialization_id,
//       specialization_name:
//         user.specialization?.specialization_name || null,

//       blood_group: user.blood_group,
//       dob: user.dob,
//       age: user.age,

//       aadhar_no: user.aadhar_no,
//       voter_id_no: user.voter_id_no,

//       contact_person: user.contact_person,
//       organisation: user.organisation,

//       address: user.address,
//       booth_no: user.booth_no,
//       pin_code: user.pin_code,

//       city: user.city,
//       district: user.district,
//       state: user.state,

//       ls_sabha_mp: user.ls_sabha_mp,
//       ls_code: user.ls_code,

//       vs_sabha_mla: user.vs_sabha_mla,
//       vs_code: user.vs_code,

//       panchayat: user.panchayat,
//       ward: user.ward,

//       mobile1: user.mobile1,
//       mobile2: user.mobile2,

//       other_phone: user.other_phone,
//       phone1_office: user.phone1_office,
//       phone2_office: user.phone2_office,
//       phone_residence: user.phone_residence,

//       email1: user.email1,
//       email2: user.email2,
//       website: user.website,

//       status: user.status,
//       is_active: user.is_active,
//       remark: user.remark,

//       member_photo: user.member_photo,
//       document_file: user.document_file,
//       aadhar_document_file: user.aadhar_document_file,
//       voter_document_file: user.voter_document_file,

//       created_at: user.created_at,
//       updated_at: user.updated_at,
//     }));

//     return res.status(200).json({
//       success: true,
//       count: formatted.length,
//       filters: {
//         issue_type,
//         category,
//         location,
//         search,
//         min_experience,
//         max_experience,
//       },
//       data: formatted,
//     });
//   } catch (error) {
//     console.error("Error fetching professional volunteers:", error);

//     return res.status(500).json({
//       success: false,
//       message: "Error fetching professional volunteers",
//       error: error.message,
//     });
//   }
// };

// // =========================
// // GET ACTIVE VOLUNTEER MEMBERS (with issue type and service type filtering)
// // =========================
// export const getActiveVolunteerMembers = async (req, res) => {
//   try {
//     let { issue_type, category, location, search, min_experience, max_experience } = req.query;
//     const loginUserId = req.user.id;

//     // Handle issue_type if it's an array (from multiple query params)
//     if (Array.isArray(issue_type)) {
//       const uniqueIssues = [...new Set(issue_type.filter(Boolean))];
//       issue_type = uniqueIssues[0] || null;
//     }

//     // First, get all user IDs where superior_id = loginUserId
//     // Note: Since there's no superior_id in your model, we'll use a different approach
//     // For now, we'll show all volunteer members that are active
//     // You can modify this based on your actual relationship structure

//     // Build where conditions
//     const whereConditions = {
//       is_active: true,
//       member_type_id: 2, // volunteer_member
//       status: "Approved"
//     };

//     // STRICT FILTERING - Required field for volunteers
//     if (!issue_type || !issue_type.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "issue_type is required",
//         data: []
//       });
//     }

//     // Category mapping for volunteer members
//     const categoryMapping = {
//       'Medical Facility': [1, 2, 3],
//       'Medical Camp': [1, 2, 4],
//       'Healthcare': [1, 2, 3, 4],
//       'Legal Aid': [5, 6, 7],
//       'Legal Awareness': [5, 6, 7],
//       'Education': [8, 9, 10],
//       'Digital Literacy': [11, 12, 13],
//       'Financial Literacy': [14, 15, 16],
//       'Housing': [17, 18, 19],
//       'Women Empowerment': [20, 21, 22],
//       'Senior Citizens': [23, 24, 25],
//       'Environment': [26, 27, 28],
//       'Business Development': [29, 30, 31],
//       'Agriculture': [32, 33, 34],
//       'Community Service': [35, 36, 37],
//       'Infrastructure': [38, 39, 40],
//       'Public Safety': [41, 42, 43],
//       'Blood Donation': [1, 2, 44]
//     };

//     const allowedCategories = categoryMapping[issue_type] || [];

//     if (allowedCategories.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid issue_type provided",
//         data: []
//       });
//     }

//     // Filter by category_id
//     whereConditions.category_id = {
//       [Op.in]: allowedCategories
//     };

//     // Additional filters
//     if (category && category.trim()) {
//       whereConditions.category_id = { [Op.in]: allowedCategories };
//     }

//     if (location && location.trim()) {
//       const locationCondition = {
//         [Op.or]: [
//           { city: { [Op.like]: `%${location}%` } },
//           { district: { [Op.like]: `%${location}%` } },
//           { state: { [Op.like]: `%${location}%` } }
//         ]
//       };

//       if (whereConditions[Op.and]) {
//         whereConditions[Op.and].push(locationCondition);
//       } else {
//         whereConditions[Op.and] = [locationCondition];
//       }
//     }

//     if (search && search.trim()) {
//       const searchCondition = {
//         [Op.or]: [
//           { full_name: { [Op.like]: `%${search}%` } },
//           { email1: { [Op.like]: `%${search}%` } },
//           { mobile1: { [Op.like]: `%${search}%` } },
//           { profession_id: { [Op.like]: `%${search}%` } }
//         ]
//       };

//       if (whereConditions[Op.and]) {
//         whereConditions[Op.and].push(searchCondition);
//       } else {
//         whereConditions[Op.and] = [searchCondition];
//       }
//     }

//     console.log("Query conditions:", JSON.stringify(whereConditions, null, 2));

//     // Execute query
//     const users = await User.findAll({
//       where: whereConditions,
//       include: [
//         {
//           model: MemberType,
//           as: 'memberType', // ✅ CORRECTED: Use 'memberType' (matches the alias in User model)
//           attributes: ['id', 'member_type_name'], // ✅ CORRECTED: Use 'member_type_name' (matches MemberType model)
//           required: false
//         },
//         {
//           model: Category,
//           as: 'category',
//           attributes: ['id', 'category_name'],
//           required: false
//         }
//       ],
//       order: [
//         ["full_name", "ASC"]
//       ],
//     });

//     // Format response
//     const formatted = users.map((user) => ({
//       id: user.id,
//       member_id: user.member_id,
//       full_name: user.full_name,
//       parent_name: user.parent_name,
//       member_type_id: user.member_type_id,
//       member_type_name: user.member_type ? user.member_type.name : null,
//       category_id: user.category_id,
//       category_name: user.category ? user.category.name : null,
//       sub_category_id: user.sub_category_id,
//       specialization_id: user.specialization_id,
//       blood_group: user.blood_group,
//       dob: user.dob,
//       age: user.age,
//       aadhar_no: user.aadhar_no,
//       voter_id_no: user.voter_id_no,
//       contact_person: user.contact_person,
//       organisation: user.organisation,
//       profession_id: user.profession_id,
//       address: user.address,
//       booth_no: user.booth_no,
//       pin_code: user.pin_code,
//       city: user.city,
//       district: user.district,
//       state: user.state,
//       ls_sabha_mp: user.ls_sabha_mp,
//       ls_code: user.ls_code,
//       vs_sabha_mla: user.vs_sabha_mla,
//       vs_code: user.vs_code,
//       panchayat: user.panchayat,
//       ward: user.ward,
//       mobile1: user.mobile1,
//       mobile2: user.mobile2,
//       other_phone: user.other_phone,
//       phone1_office: user.phone1_office,
//       phone2_office: user.phone2_office,
//       phone_residence: user.phone_residence,
//       email1: user.email1,
//       email2: user.email2,
//       website: user.website,
//       status: user.status,
//       is_active: user.is_active,
//       remark: user.remark,
//       document_file: user.document_file,
//       member_photo: user.member_photo,
//       aadhar_document_file: user.aadhar_document_file,
//       voter_document_file: user.voter_document_file,
//       created_at: user.created_at,
//       updated_at: user.updated_at,
//     }));

//     return res.status(200).json({
//       success: true,
//       count: formatted.length,
//       filters: { issue_type, category, location, search, min_experience, max_experience },
//       data: formatted,
//     });
//   } catch (error) {
//     console.error("Error fetching volunteer members:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Error fetching volunteer members",
//       error: error.message,
//     });
//   }
// };









// =========================
// GET ACTIVE PROFESSIONAL VOLUNTEERS (with category_id filtering)
// URL: /auth/member_type_id=2/active?category_id=8
// =========================
export const getActiveProfessionalVolunteers = async (req, res) => {
  try {
    let {
      category_id,
      issue_member_id,
      location,
      search,
    } = req.query;

    // Base conditions
    const whereConditions = {
      is_active: true,
      status: "Approved",
      member_type_id: 2, // professional_volunteer
    };

    // category_id is mandatory
    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "category_id is required",
        data: [],
      });
    }

    // Validate category_id is a number
    const categoryIdNum = parseInt(category_id);
    if (isNaN(categoryIdNum) || categoryIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category_id. Must be a positive integer.",
        data: [],
      });
    }

    // Check if category exists
    const categoryExists = await Category.findByPk(categoryIdNum);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: [],
      });
    }

    // Apply category_id filter
    whereConditions.category_id = categoryIdNum;

    // =============================================
    // GET ISSUE MEMBER DISTRICT (using users.id)
    // =============================================
    let issueMemberDistrict = null;
    let issueMemberDetails = null;

    if (issue_member_id) {
      const issueMemberIdNum = parseInt(issue_member_id);
      if (!isNaN(issueMemberIdNum) && issueMemberIdNum > 0) {
        // Get the user directly from Users table using the ID
        const user = await User.findByPk(issueMemberIdNum, {
          attributes: [
            'id', 
            'full_name', 
            'district', 
            'city', 
            'state',
            'mobile1',
            'email1',
            'member_type_id',
            'member_id'
          ]
        });

        if (user) {
          issueMemberDistrict = user.district;
          issueMemberDetails = {
            id: user.id,
            member_id: user.member_id,
            full_name: user.full_name,
            district: user.district,
            city: user.city,
            state: user.state,
            mobile1: user.mobile1,
            email1: user.email1,
            member_type_id: user.member_type_id
          };

          console.log(`Issue member district: ${issueMemberDistrict}`);
        } else {
          return res.status(404).json({
            success: false,
            message: "User not found with the provided ID",
            data: [],
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: "Invalid issue_member_id. Must be a positive integer.",
          data: [],
        });
      }
    }

    // =============================================
    // APPLY DISTRICT FILTER (if issue_member_id provided)
    // =============================================
    if (issueMemberDistrict) {
      // Filter professional volunteers by the same district
      whereConditions.district = issueMemberDistrict;
      
      console.log(`Filtering professional volunteers by district: ${issueMemberDistrict}`);
    }

    // Location Filter (only if location is provided and no issue_member_id)
    if (location && !issue_member_id) {
      const locationFilter = {
        [Op.or]: [
          { city: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } },
          { "address.area": { [Op.like]: `%${location}%` } },
          { "address.city": { [Op.like]: `%${location}%` } },
          { "address.district": { [Op.like]: `%${location}%` } },
          { "address.state": { [Op.like]: `%${location}%` } },
        ],
      };

      whereConditions[Op.and] = whereConditions[Op.and] || [];
      whereConditions[Op.and].push(locationFilter);
    }

    // Search Filter
    if (search) {
      const searchFilter = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email1: { [Op.like]: `%${search}%` } },
          { mobile1: { [Op.like]: `%${search}%` } },
          { organisation: { [Op.like]: `%${search}%` } },
          { member_id: { [Op.like]: `%${search}%` } },
        ],
      };

      whereConditions[Op.and] = whereConditions[Op.and] || [];
      whereConditions[Op.and].push(searchFilter);
    }

    console.log("Query conditions:", JSON.stringify(whereConditions, null, 2));

    // =============================================
    // GET PROFESSIONAL VOLUNTEERS
    // =============================================
    const users = await User.findAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name", "description"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],
      order: [["full_name", "ASC"]],
      attributes: {
        exclude: ["password", "reset_token", "reset_token_expiry"],
      },
    });

    // =============================================
    // FORMAT RESPONSE
    // =============================================
    const formatted = users.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      full_name: user.full_name,
      parent_name: user.parent_name,

      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,

      category_id: user.category_id,
      category_name: user.category?.category_name || null,
      category_description: user.category?.description || null,

      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name: user.specialization?.specialization_name || null,

      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,

      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,

      contact_person: user.contact_person,
      organisation: user.organisation,

      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,

      city: user.city,
      district: user.district,
      state: user.state,

      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,

      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,

      panchayat: user.panchayat,
      ward: user.ward,

      mobile1: user.mobile1,
      mobile2: user.mobile2,

      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,

      email1: user.email1,
      email2: user.email2,
      website: user.website,

      status: user.status,
      is_active: user.is_active,
      remark: user.remark,

      member_photo: user.member_photo,
      document_file: user.document_file,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,

      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      filters: {
        category_id: categoryIdNum,
        issue_member_id: issue_member_id || null,
        issue_member_district: issueMemberDistrict || null,
        issue_member_details: issueMemberDetails || null,
        location: location || null,
        search: search || null,
        district_filter_applied: !!issueMemberDistrict,
      },
      data: formatted,
    });

  } catch (error) {
    console.error("Error fetching professional volunteers:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching professional volunteers",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// =========================
// GET ACTIVE VOLUNTEER MEMBERS (with category_id filtering)
// URL: /auth/member_type_id=3/active?category_id=8
// =========================
export const getActiveVolunteerMembers = async (req, res) => {
  try {
    let {
      category_id,
      location,
      search,
    } = req.query;

    const loginUserId = req.user.id;

    // Base conditions
    const whereConditions = {
      is_active: true,
      status: "Approved",
      member_type_id: 3, // volunteer_member
    };

    // category_id is mandatory
    if (!category_id) {
      return res.status(400).json({
        success: false,
        message: "category_id is required",
        data: [],
      });
    }

    // Validate category_id is a number
    const categoryIdNum = parseInt(category_id);
    if (isNaN(categoryIdNum) || categoryIdNum <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid category_id. Must be a positive integer.",
        data: [],
      });
    }

    // Check if category exists
    const categoryExists = await Category.findByPk(categoryIdNum);
    if (!categoryExists) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
        data: [],
      });
    }

    // Apply category_id filter
    whereConditions.category_id = categoryIdNum;

    // Location Filter
    if (location) {
      const locationFilter = {
        [Op.or]: [
          { city: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } },
          { "address.area": { [Op.like]: `%${location}%` } },
          { "address.city": { [Op.like]: `%${location}%` } },
          { "address.district": { [Op.like]: `%${location}%` } },
          { "address.state": { [Op.like]: `%${location}%` } },
        ],
      };

      whereConditions[Op.and] = whereConditions[Op.and] || [];
      whereConditions[Op.and].push(locationFilter);
    }

    // Search Filter
    if (search) {
      const searchFilter = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email1: { [Op.like]: `%${search}%` } },
          { mobile1: { [Op.like]: `%${search}%` } },
          { organisation: { [Op.like]: `%${search}%` } },
          { member_id: { [Op.like]: `%${search}%` } },
        ],
      };

      whereConditions[Op.and] = whereConditions[Op.and] || [];
      whereConditions[Op.and].push(searchFilter);
    }

    console.log("Query conditions:", JSON.stringify(whereConditions, null, 2));

    const users = await User.findAll({
      where: whereConditions,
      include: [
        {
          model: MemberType,
          as: "memberType",
          attributes: ["id", "member_type_name"],
        },
        {
          model: Category,
          as: "category",
          attributes: ["id", "category_name", "description"],
        },
        {
          model: SubCategory,
          as: "sub_category",
          attributes: ["id", "sub_category_name"],
        },
        {
          model: Profession,
          as: "profession",
          attributes: ["id", "profession_name"],
        },
        {
          model: Specialization,
          as: "specialization",
          attributes: ["id", "specialization_name"],
        },
      ],
      order: [["full_name", "ASC"]],
      attributes: {
        exclude: ["password", "reset_token", "reset_token_expiry"],
      },
    });

    const formatted = users.map((user) => ({
      id: user.id,
      member_id: user.member_id,
      full_name: user.full_name,
      parent_name: user.parent_name,

      member_type_id: user.member_type_id,
      member_type_name: user.memberType?.member_type_name || null,

      category_id: user.category_id,
      category_name: user.category?.category_name || null,
      category_description: user.category?.description || null,

      sub_category_id: user.sub_category_id,
      sub_category_name: user.sub_category?.sub_category_name || null,

      profession_id: user.profession_id,
      profession_name: user.profession?.profession_name || null,

      specialization_id: user.specialization_id,
      specialization_name: user.specialization?.specialization_name || null,

      blood_group: user.blood_group,
      dob: user.dob,
      age: user.age,

      aadhar_no: user.aadhar_no,
      voter_id_no: user.voter_id_no,

      contact_person: user.contact_person,
      organisation: user.organisation,

      address: user.address,
      booth_no: user.booth_no,
      pin_code: user.pin_code,

      city: user.city,
      district: user.district,
      state: user.state,

      ls_sabha_mp: user.ls_sabha_mp,
      ls_code: user.ls_code,

      vs_sabha_mla: user.vs_sabha_mla,
      vs_code: user.vs_code,

      panchayat: user.panchayat,
      ward: user.ward,

      mobile1: user.mobile1,
      mobile2: user.mobile2,

      other_phone: user.other_phone,
      phone1_office: user.phone1_office,
      phone2_office: user.phone2_office,
      phone_residence: user.phone_residence,

      email1: user.email1,
      email2: user.email2,
      website: user.website,

      status: user.status,
      is_active: user.is_active,
      remark: user.remark,

      member_photo: user.member_photo,
      document_file: user.document_file,
      aadhar_document_file: user.aadhar_document_file,
      voter_document_file: user.voter_document_file,

      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      filters: {
        category_id,
        location,
        search,
      },
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching volunteer members:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching volunteer members",
      error: error.message,
    });
  }
};




export const verifyPhoneNumber = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required",
      });
    }

    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number",
      });
    }

    // Check user
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile1: phoneNumber },
          { mobile2: phoneNumber },
        ],
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this mobile number.",
      });
    }

    if (user.is_active === 0) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive.",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP
    await user.update({
      otp_code: otp,
      otp_expiry: otpExpiry,
      reset_token: null,
      reset_token_expiry: null,
    });

    // Send SMS
    const smsResponse = await sendOTP(phoneNumber, otp);

    if (!smsResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP",
        twilio: smsResponse,
      });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      messageSid: smsResponse.sid,
      status: smsResponse.status,

      // Remove in production
      ...(process.env.NODE_ENV === "development" && { otp }),
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined,
    });
  }
};

// =========================
// VERIFY OTP
// =========================
export const verifyOtp = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    if (!phoneNumber || !otp) {
      return res.status(400).json({
        success: false,
        message: "Phone number and OTP are required"
      });
    }

    // Find user with this phone number and OTP
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile1: phoneNumber },
          { mobile2: phoneNumber }
        ],
        otp_code: otp
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again."
      });
    }

    // Check if OTP has expired
    if (user.otp_expiry && new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one."
      });
    }

    // Generate reset token (valid for 10 minutes)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);

    await user.update({
      reset_token: resetToken,
      reset_token_expiry: expiryTime,
      otp_code: null,
      otp_expiry: null
    });

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token: resetToken
    });

  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying OTP",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =========================
// RESEND OTP
// =========================
export const resendOtp = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10-digit mobile number"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile1: phoneNumber },
          { mobile2: phoneNumber }
        ]
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this phone number"
      });
    }

    // Generate New OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    await user.update({
      otp_code: otp,
      otp_expiry: otpExpiry
    });

    // Send OTP using Twilio
    const smsResponse = await sendOTP(phoneNumber, otp);

    if (!smsResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP",
        twilio: smsResponse
      });
    }

    return res.status(200).json({
      success: true,
      message: "New OTP sent successfully",
      messageSid: smsResponse.sid,
      status: smsResponse.status,

      // Remove in production
      ...(process.env.NODE_ENV === "development" && { otp })
    });

  } catch (error) {
    console.error("Error resending OTP:", error);

    return res.status(500).json({
      success: false,
      message: "Error resending OTP",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : undefined
    });
  }
};





// =========================
// RESET PASSWORD
// =========================
export const resetPassword = async (req, res) => {
  try {
    const { phoneNumber, newPassword, token } = req.body;

    if (!phoneNumber || !newPassword || !token) {
      return res.status(400).json({
        success: false,
        message: "Phone number, new password, and token are required"
      });
    }

    // Validate password strength
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters with uppercase, lowercase, number, and special character"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile1: phoneNumber },
          { mobile2: phoneNumber }
        ],
        reset_token: token
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired reset token"
      });
    }

    // Check if token has expired
    if (user.reset_token_expiry && new Date() > new Date(user.reset_token_expiry)) {
      return res.status(400).json({
        success: false,
        message: "Reset token has expired. Please request a new one."
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      otp_code: null,
      otp_expiry: null
    });

    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please login with your new password."
    });

  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =========================
// CHECK IF MOBILE EXISTS
// =========================
export const checkMobileExists = async (req, res) => {
  try {
    const { mobileNumber } = req.params;

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: "Mobile number is required"
      });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { mobile1: mobileNumber },
          { mobile2: mobileNumber }
        ]
      },
      attributes: ['id', 'full_name', 'mobile1', 'mobile2', 'is_active', 'status']
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        exists: false,
        message: "No account found with this mobile number. Please register first."
      });
    }

    res.status(200).json({
      success: true,
      exists: true,
      user: {
        id: user.id,
        fullName: user.full_name,
        mobile1: user.mobile1,
        mobile2: user.mobile2,
        isActive: user.is_active,
        status: user.status
      }
    });

  } catch (error) {
    console.error("Error checking mobile:", error);
    res.status(500).json({
      success: false,
      message: "Error checking mobile number",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// =========================
// VERIFY DATE OF BIRTH - NEW
// =========================
export const verifyDob = async (req, res) => {
  try {
    const { phoneNumber, dob } = req.body;

    if (!phoneNumber || !dob) {
      return res.status(400).json({
        success: false,
        message: "Phone number and Date of Birth are required"
      });
    }

    // Find user by phone number
    const user = await User.findOne({
      where: {
        mobile1: phoneNumber
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this phone number"
      });
    }

    // Check if DOB matches (format: YYYY-MM-DD)
    const userDob = user.dob ? new Date(user.dob).toISOString().split('T')[0] : null;
    const providedDob = new Date(dob).toISOString().split('T')[0];

    if (userDob !== providedDob) {
      return res.status(400).json({
        success: false,
        message: "Date of Birth does not match our records"
      });
    }

    // Update token expiry to extend for password reset
    const expiryTime = new Date(Date.now() + 10 * 60 * 1000);
    await user.update({
      reset_token_expiry: expiryTime
    });

    res.status(200).json({
      success: true,
      message: "Date of Birth verified successfully"
    });

  } catch (error) {
    console.error("Error verifying DOB:", error);
    res.status(500).json({
      success: false,
      message: "Error verifying Date of Birth",
      error: error.message
    });
  }
};


// =========================
// RESET PASSWORD WITH PHONE
// =========================
export const resetPasswordWithPhone = async (req, res) => {
  try {
    const { phoneNumber, newPassword } = req.body;

    if (!phoneNumber || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Phone number and new password required"
      });
    }

    // Validate password strength
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters"
      });
    }

    // Find user by phone number and check token validity
    const user = await User.findOne({
      where: {
        mobile1: phoneNumber,
        reset_token: {
          [Op.ne]: null
        },
        reset_token_expiry: {
          [Op.gt]: new Date()
        }
      }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification. Please request again."
      });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully! Please login with your new password."
    });

  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
      error: error.message
    });
  }
};