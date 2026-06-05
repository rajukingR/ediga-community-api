import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../models/index.js';
import { Op } from "sequelize";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { sendPushToUser } from "../../services/pushService.js";

const User = db.User;
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

// Helper function to format user response
const formatUserResponse = (user) => {
  return {
    id: user.id,
    member_id: user.member_id,

    full_name: user.full_name,
    parents_name: user.parents_name,
    member_type: user.member_type,
    superior_id: user.superior_id,
    category: user.category,
    blood_group: user.blood_group,

    date_of_birth: user.date_of_birth,
    age: user.age,

    years_of_experience: user.years_of_experience,
    service_type: user.service_type,

    voter_id: user.voter_id,
    aadhaar_number: user.aadhaar_number,

    organization: user.organization,
    profession: user.profession,
    business_description: user.business_description,

    address: user.address,

    booth_no: user.booth_no,
    taluk_zone: user.taluk_zone,
    city: user.city,
    district: user.district,
    state: user.state,
    pin_code: user.pin_code,

    ls_sabha: user.ls_sabha,
    vs_sabha: user.vs_sabha,

    panchayat: user.panchayat,
    ward: user.ward,
    area: user.area,

    mobile_1: user.mobile_1,
    mobile_2: user.mobile_2,
    phone_1: user.phone_1,
    phone_2: user.phone_2,

    email: user.email,
    email_2: user.email_2,
    website: user.website,

    status: user.status,
    is_active: user.is_active,
    remark: user.remark,

    document_file: user.document_file,
    photo: user.photo,
    aadhaar_photo: user.aadhaar_photo,
    voter_photo: user.voter_photo,

    last_login: user.last_login,
    created_at: user.created_at,
    updated_at: user.updated_at
  };
};


export const signup = async (req, res) => {
  try {
    const {
      full_name,
      parents_name,
      member_type,
      created_by_id,
      category,
      blood_group,
      date_of_birth,
      age,
      years_of_experience,
      service_type,
      voter_id,
      aadhaar_number,
      member_id,
      organization,
      profession,
      business_description,
      address,
      booth_no,
      taluk_zone,
      city,
      district,
      state,
      pin_code,
      ls_sabha,
      vs_sabha,
      panchayat,
      ward,
      area,
      mobile_1,
      mobile_2,
      phone_1,
      phone_2,
      email_1,
      email_2,
      website,
      password,
      remark
    } = req.body;

    // Validation
    if (!full_name || !email_1 || !password) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required",
      });
    }

    // Check existing user
    const existingUser = await User.findOne({ where: { email: email_1 } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "Email already registered",
      });
    }

    // Check mobile
    if (mobile_1) {
      const existingMobile = await User.findOne({ where: { mobile_1 } });
      if (existingMobile) {
        return res.status(400).json({
          success: false,
          message: "Mobile number already registered",
        });
      }
    }

    // Validate service type for volunteer_member and professional_volunteer
    if ((member_type === 'volunteer_member' || member_type === 'professional_volunteer') && !service_type) {
      return res.status(400).json({
        success: false,
        message: "Service type is required for volunteer members and professional volunteers",
      });
    }

    // ========== WEBSITE SELF-REGISTRATION (ALL TYPES) ==========
    // No permission checks - anyone can register any type via website
    // All registrations need admin approval
    let status = "pending";
    let needsApproval = true;
    let notificationsData = [];

    // For website registration, created_by_id should ALWAYS be null
    // But if someone sends it, we ignore and set to null
    const finalCreatedById = null; // Force null for website registration
    
    // Get all admins for notification
    const admins = await User.findAll({ 
      where: { member_type: 'admin', is_active: 1 }
    });

    // Role text mapping for notifications
    const roleText = {
      'professional_volunteer': 'Professional Volunteer',
      'volunteer_member': 'Volunteer Member',
      'member': 'Member'
    };

    const memberTypeText = roleText[member_type] || member_type;
    const newMemberName = full_name;

    // Prepare notifications for all admins
    for (const admin of admins) {
      let adminMessage = '';
      
      if (member_type === 'professional_volunteer') {
        adminMessage = `${full_name} registered as a ${memberTypeText} (Service: ${service_type || 'N/A'}). Please review and approve.`;
      } else if (member_type === 'volunteer_member') {
        adminMessage = `${full_name} registered as a ${memberTypeText} (Service: ${service_type || 'N/A'}). Please review and approve.`;
      } else {
        adminMessage = `${full_name} registered as a ${memberTypeText}. Please review and approve.`;
      }
      
      notificationsData.push({
        user_id: admin.id,
        message: adminMessage,
        user_type: 'admin',
        recipient_name: admin.full_name,
        push_title: "🔔 New Member Registration",
        push_body: adminMessage
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Handle file uploads
    const document_file = req.files?.document_file?.[0]?.filename || null;
    const photo = req.files?.photo?.[0]?.filename || null;
    const aadhaar_photo = req.files?.aadhaar_photo?.[0]?.filename || null;
    const voter_photo = req.files?.voter_photo?.[0]?.filename || null;

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
    const finalMemberId = member_id || `MEM${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create user (superior_id is always NULL for website registration)
    const newUser = await User.create({
      member_id: finalMemberId,
      full_name,
      parents_name,
      member_type,
      superior_id: null,  // Always null for website registration
      category: category || null,
      blood_group: blood_group || null,
      date_of_birth: date_of_birth || null,
      age: age || (date_of_birth ? calculateAge(date_of_birth) : null),
      years_of_experience: years_of_experience || null,
      service_type: (member_type === 'volunteer_member' || member_type === 'professional_volunteer') ? service_type : null,
      voter_id: voter_id || null,
      aadhaar_number: aadhaar_number || null,
      organization: organization || null,
      profession: profession || null,
      business_description: business_description || null,
      address: parsedAddress,
      booth_no: booth_no || null,
      taluk_zone: taluk_zone || null,
      city: city || null,
      district: district || null,
      state: state || null,
      pin_code: pin_code || null,
      ls_sabha: ls_sabha || null,
      vs_sabha: vs_sabha || null,
      panchayat: panchayat || null,
      ward: ward || null,
      area: area || null,
      mobile_1: mobile_1 || null,
      mobile_2: mobile_2 || null,
      phone_1: phone_1 || null,
      phone_2: phone_2 || null,
      email: email_1,
      email_2: email_2 || null,
      website: website || null,
      password: hashedPassword,
      status: status,  // Always 'pending' for website registration
      is_active: 1,
      remark: remark || null,
      document_file: document_file,
      photo: photo,
      aadhaar_photo: aadhaar_photo,
      voter_photo: voter_photo,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // ========== SEND NOTIFICATIONS TO ADMINS ==========
    if (notificationsData.length > 0) {
      // Database notifications
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
          member_type: member_type,
          service_type: service_type || null,
          mobile_number: newUser.mobile_1,
          email: newUser.email,
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
              member_type: member_type,
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

    // Response
    return res.status(201).json({
      success: true,
      message: `Thank you for registering as ${memberTypeText}. Your application has been submitted and is pending admin approval. You will be notified once approved.`,
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
// SIGNIN / LOGIN
// =========================
export const signin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: "Your account is inactive. Please contact admin.",
      });
    }

    // Check status (pending/approved/rejected)
    if (user.status === "rejected") {
      return res.status(403).json({
        success: false,
        message: "Your registration has been rejected. Please contact admin.",
      });
    }

    if (user.status === "pending") {
      return res.status(403).json({
        success: false,
        message: "Your account is pending approval. Please wait for admin verification.",
      });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        member_type: user.member_type,
        status: user.status
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      message: "Signin successful",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        member_type: user.member_type,
        email: user.email,
        mobile_1: user.mobile_1,
        address: user.address,
        photo: user.photo,
        status: user.status,
        is_active: user.is_active,
        service_type: user.service_type, // Added new field
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

// controllers/userController.js (partial – only the updated getAllUsers)
export const getAllUsers = async (req, res) => {
  try {
    const {
      district,
      member_type, // can be string or comma-separated list
      search,
    } = req.query;

    const whereConditions = {
      status: "approved",
      is_active: 1,
      // ✅ EXCLUDE admin users
      member_type: { [Op.ne]: 'admin' }, // Not equal to 'admin'
    };

    // District – partial match
    if (district && district.trim() !== "") {
      whereConditions.district = { [Op.like]: `%${district}%` };
    }

    // Member Type – support multiple values (overwrites the exclude condition if specified)
    if (member_type && member_type.trim() !== "" && member_type !== "all") {
      let typesArray = [];
      if (member_type.includes(",")) {
        typesArray = member_type.split(",").map(t => t.trim());
      } else {
        typesArray = [member_type.trim()];
      }
      // Remove empty values
      typesArray = typesArray.filter(t => t !== "");
      
      if (typesArray.length > 0) {
        // If 'admin' is explicitly requested, we need to handle it differently
        if (typesArray.includes('admin')) {
          // If admin is requested, remove the exclusion
          delete whereConditions.member_type;
          whereConditions.member_type = { [Op.in]: typesArray };
        } else {
          // Otherwise, keep the exclusion and add the filter
          whereConditions.member_type = { 
            [Op.and]: [
              { [Op.ne]: 'admin' },
              { [Op.in]: typesArray }
            ]
          };
        }
      }
    }

    // Search by name or mobile
    if (search && search.trim() !== "") {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { mobile_1: { [Op.like]: `%${search}%` } },
      ];
    }

    const users = await User.findAll({
      where: whereConditions,
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
      member_type,
      service_type,
      search
    } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    const loginUserId = req.user.id;
    const loginRoleName = req.user.member_type;

    // Base condition
    const whereConditions = {
      status: "pending"
    };

    // =========================
    // ROLE BASED ACCESS
    // =========================
    if (loginRoleName === "admin") {
      // Admin can see all pending users except admin
      whereConditions.member_type = {
        [Op.ne]: "admin"
      };
    }
    else if (loginRoleName === "professional_volunteer") {

      // Get volunteer members under this professional volunteer
      const volunteerMembers = await User.findAll({
        where: {
          member_type: "volunteer_member",
          superior_id: loginUserId
        },
        attributes: ["id"]
      });

      const volunteerMemberIds = volunteerMembers.map(vm => vm.id);

      whereConditions.member_type = {
        [Op.in]: ["member", "volunteer_member"]
      };

      whereConditions[Op.or] = [
        // Volunteer members directly assigned to Professional Volunteer
        {
          superior_id: loginUserId
        },

        // Members created by Volunteer Members
        {
          superior_id: {
            [Op.in]: volunteerMemberIds.length > 0
              ? volunteerMemberIds
              : [0]
          }
        }
      ];
    }
    else {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to view pending users",
      });
    }

    // =========================
    // FILTERS
    // =========================

    if (
      member_type &&
      ["member", "professional_volunteer", "volunteer_member"].includes(member_type)
    ) {
      if (loginRoleName === "admin") {
        whereConditions.member_type = member_type;
      } else if (
        loginRoleName === "professional_volunteer" &&
        ["member", "volunteer_member"].includes(member_type)
      ) {
        whereConditions.member_type = member_type;
      }
    }

    if (service_type) {
      whereConditions.service_type = service_type;
    }

    // =========================
    // SEARCH
    // =========================

    if (search) {
      whereConditions[Op.and] = whereConditions[Op.and] || [];

      whereConditions[Op.and].push({
        [Op.or]: [
          {
            full_name: {
              [Op.like]: `%${search}%`,
            },
          },
          {
            email: {
              [Op.like]: `%${search}%`,
            },
          },
          {
            mobile_1: {
              [Op.like]: `%${search}%`,
            },
          },
          {
            profession: {
              [Op.like]: `%${search}%`,
            },
          },
          {
            organization: {
              [Op.like]: `%${search}%`,
            },
          },
        ],
      });
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: "superior",
          attributes: [
            "id",
            "full_name",
            "member_type",

          ],
          required: false
        }
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
      parents_name: user.parents_name,
      member_type: user.member_type,
      superior_id: user.superior_id,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type,
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
      superior_details: user.superior
        ? {
          id: user.superior.id,
          full_name: user.superior.full_name,
          member_type: user.superior.member_type,
          mobile_1: user.superior.mobile_1,
          email: user.superior.email
        }
        : null,
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
// GET ALL APPROVED MEMBERS (member_type = 'member')
// =========================
export const getAllMembers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;


    const loginUserId = req.user.id;
    const loginRoleName = req.user.member_type;

    const whereConditions = {
      member_type: 'member',
    };

    // Admin can see all approved members
    if (loginRoleName === 'admin') {
            whereConditions.status = 'approved';


    } else if (loginRoleName === 'professional_volunteer') {

      // Get volunteer members under this professional volunteer
      const volunteerMembers = await User.findAll({
        where: {
          member_type: 'volunteer_member',
          superior_id: loginUserId
        },
        attributes: ['id']
      });

      const volunteerMemberIds = volunteerMembers.map(vm => vm.id);

      whereConditions[Op.or] = [
        // Members directly under professional volunteer
        {
          superior_id: loginUserId
        },

        // Members created by volunteer members
        {
          superior_id: {
            [Op.in]: volunteerMemberIds.length > 0
              ? volunteerMemberIds
              : [0]
          }
        }
      ];

    } else if (loginRoleName === 'volunteer_member') {

      // Volunteer member sees only members created by them
      whereConditions.superior_id = loginUserId;

    } else {

      // Member role can only see themselves or no records
      whereConditions.superior_id = loginUserId;
    }

    // Additional filters
    if (category) whereConditions.category = category;
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { district: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: "superior",
          attributes: ["id", "full_name", "member_type"],
          required: false
        }
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
      superior_details: user.superior
        ? {
          id: user.superior.id,
          full_name: user.superior.full_name,
          member_type: user.superior.member_type,

        }
        : null,
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
// GET ALL APPROVED VOLUNTEER MEMBERS (member_type = 'volunteer_member')
// =========================
export const getAllVolunteerMembers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, service_type, search, is_active } = req.query; // Added service_type

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;


    const loginUserId = req.user.id;
    const loginRoleName = req.user.member_type;

    const whereConditions = {
      member_type: 'volunteer_member',
    };

    // Admin can see all approved members
    if (loginRoleName === 'admin') {
      whereConditions.status = 'approved';
    } else {
      // Other roles can see only their own members
      whereConditions.superior_id = loginUserId;
    }


    // Additional filters
    if (category) whereConditions.category = category;
    if (service_type) whereConditions.service_type = service_type; // Added service_type filter
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { business_description: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: "superior",
          attributes: [
            "id",
            "full_name",
            "member_type",
          ],
          required: false
        }
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
      superior_details: user.superior
        ? {
          id: user.superior.id,
          full_name: user.superior.full_name,
          member_type: user.superior.member_type,
          mobile_1: user.superior.mobile_1,
          email: user.superior.email
        }
        : null,
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
// GET ALL APPROVED PROFESSIONAL VOLUNTEERS (member_type = 'professional_volunteer')
// =========================
export const getAllProfessionalVolunteers = async (req, res) => {
  try {
    let { page = 1, limit = 10, category, search, is_active } = req.query;

    page = Number(page);
    limit = Number(limit);
    const offset = (page - 1) * limit;

    // Build where conditions for professional volunteers
    const whereConditions = {
      member_type: 'professional_volunteer',
      status: 'approved'
    };

    // Additional filters
    if (category) whereConditions.category = category;
    if (is_active !== undefined) whereConditions.is_active = is_active === 'true';

    if (search) {
      whereConditions[Op.or] = [
        { full_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { profession: { [Op.like]: `%${search}%` } },
        { organization: { [Op.like]: `%${search}%` } },
        { business_description: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } }
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where: whereConditions,
      limit,
      offset,
      order: [["created_at", "DESC"]],
      attributes: { exclude: ['password'] }
    });

    const formatted = rows.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      last_login: user.last_login,
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
export const getActiveProfessionalVolunteers = async (req, res) => {
  try {
    let { issue_type, category, location, search, min_experience, max_experience, service_type } = req.query;

    // Handle issue_type if it's an array (from multiple query params)
    if (Array.isArray(issue_type)) {
      const uniqueIssues = [...new Set(issue_type.filter(Boolean))];
      issue_type = uniqueIssues[0] || null;
    }


    // Build where conditions
    const whereConditions = {
      is_active: true,
      member_type: {
        [Op.in]: ["professional_volunteer", "volunteer_member"]
      },
      status: "approved"
    };

    // STRICT FILTERING - Required field
    if (!issue_type || !issue_type.trim()) {
      return res.status(400).json({
        success: false,
        message: "issue_type is required",
        data: []
      });
    }

    // Define category mapping for issue types
    const categoryMapping = {
      'Medical Facility': ['Doctor', 'Medical', 'Healthcare', 'Cardiologist', 'Neurologist', 'Orthopedic', 'Pediatrician', 'Gynecologist', 'Surgeon'],
      'Medical Camp': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Paramedic'],
      'Healthcare': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Physician', 'Dentist'],
      'Legal Aid': ['Legal', 'Lawyer', 'Advocate', 'Attorney', 'Legal Advisor'],
      'Legal Awareness': ['Legal', 'Lawyer', 'Advocate', 'Attorney', 'Legal Consultant'],
      'Education': ['Education', 'Teacher', 'Educator', 'Professor', 'Tutor', 'Trainer'],
      'Digital Literacy': ['IT', 'Technology', 'Engineer', 'Computer', 'Digital', 'Programmer'],
      'Financial Literacy': ['Finance', 'Accountant', 'CA', 'Financial', 'Banking', 'Chartered Accountant'],
      'Housing': ['Housing', 'Architect', 'Civil Engineer', 'Construction', 'Real Estate'],
      'Women Empowerment': ['Women', 'Social Work', 'Counselor', 'NGO', 'Gender'],
      'Senior Citizens': ['Elderly', 'Senior Care', 'Geriatric', 'Social Work'],
      'Environment': ['Environment', 'Ecology', 'Conservation', 'Climate', 'Green'],
      'Business Development': ['Business', 'Entrepreneurship', 'Management', 'Consulting'],
      'Agriculture': ['Agriculture', 'Farming', 'Agronomy', 'Horticulture'],
      'Community Service': ['Community', 'Social Work', 'NGO', 'Volunteer'],
      'Infrastructure': ['Infrastructure', 'Civil Engineer', 'Construction', 'Urban Planning'],
      'Public Safety': ['Safety', 'Security', 'Police', 'Defense', 'Emergency'],
      'Blood Donation': ['Medical', 'Healthcare', 'Doctor', 'Blood Bank']
    };

    const allowedCategories = categoryMapping[issue_type] || [];



    // IMPORTANT FIX: Filter by category AND profession
    // The category field must match the allowed categories
    whereConditions.category = {
      [Op.in]: allowedCategories
    };

    // Also check profession as a secondary filter
    const professionKeywords = {
      'Medical Facility': ['Doctor', 'Medical', 'Healthcare', 'Physician', 'Cardiologist', 'Neurologist', 'Orthopedic'],
      'Medical Camp': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Paramedic'],
      'Healthcare': ['Doctor', 'Medical', 'Healthcare', 'Nurse', 'Physician'],
      'Legal Aid': ['Lawyer', 'Advocate', 'Legal', 'Attorney'],
      'Legal Awareness': ['Lawyer', 'Advocate', 'Legal', 'Attorney'],
      'Education': ['Teacher', 'Educator', 'Education', 'Professor', 'Tutor'],
      'Digital Literacy': ['Engineer', 'IT', 'Computer', 'Technology', 'Programmer'],
      'Financial Literacy': ['Chartered Accountant', 'Accountant', 'Finance', 'CA'],
      'Housing': ['Architect', 'Civil Engineer', 'Construction'],
      'Women Empowerment': ['Social Worker', 'Counselor'],
      'Senior Citizens': ['Social Worker', 'Counselor'],
      'Environment': ['Environmentalist', 'Ecologist'],
      'Business Development': ['Business', 'Entrepreneur', 'Economist'],
      'Agriculture': ['Agricultural', 'Agronomist'],
      'Community Service': ['Social Worker', 'Volunteer'],
      'Infrastructure': ['Engineer', 'Architect', 'Civil Engineer'],
      'Public Safety': ['Security', 'Safety'],
      'Blood Donation': ['Doctor', 'Medical', 'Healthcare']
    };

    const professionKeywordsList = professionKeywords[issue_type] || [];

    if (professionKeywordsList.length > 0) {
      // Add profession filter as well for stricter matching
      const professionConditions = professionKeywordsList.map(keyword => ({
        profession: { [Op.like]: `%${keyword}%` }
      }));

      // Combine category and profession filters
      whereConditions[Op.and] = [
        { category: { [Op.in]: allowedCategories } },
        { [Op.or]: professionConditions }
      ];

      // Remove the direct category filter since we're using Op.and
      delete whereConditions.category;
    }

    // Additional filters
    if (category && category.trim()) {
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ category: category });
      } else {
        whereConditions.category = category;
      }
    }

    if (location && location.trim()) {
      const locationCondition = {
        [Op.or]: [
          { city: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } }
        ]
      };

      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(locationCondition);
      } else {
        whereConditions[Op.and] = [locationCondition];
      }
    }

    if (search && search.trim()) {
      const searchCondition = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { mobile_1: { [Op.like]: `%${search}%` } },
          { profession: { [Op.like]: `%${search}%` } }
        ]
      };

      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(searchCondition);
      } else {
        whereConditions[Op.and] = [searchCondition];
      }
    }

    if (min_experience || max_experience) {
      const experienceCondition = {};
      if (min_experience) experienceCondition[Op.gte] = parseInt(min_experience);
      if (max_experience) experienceCondition[Op.lte] = parseInt(max_experience);
      whereConditions.years_of_experience = experienceCondition;
    }

    const users = await User.findAll({
      where: whereConditions,
      order: [
        ["years_of_experience", "DESC"],
        ["full_name", "ASC"]
      ],
    });


    const formatted = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      filters: { issue_type, category, location, search, min_experience, max_experience, service_type },
      data: formatted,
    });
  } catch (error) {
    console.error("Error fetching professionals:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching professionals",
      error: error.message,
    });
  }
};




// =========================
// GET ACTIVE VOLUNTEER MEMBERS (with issue type and service type filtering)
// =========================
export const getActiveVolunteerMembers = async (req, res) => {
  try {
    let { issue_type, category, location, search, min_experience, max_experience, service_type } = req.query;
    const loginUserId = req.user.id;

    // Handle issue_type if it's an array (from multiple query params)
    if (Array.isArray(issue_type)) {
      const uniqueIssues = [...new Set(issue_type.filter(Boolean))];
      issue_type = uniqueIssues[0] || null;
    }

    // Handle service_type if it's an array
    if (Array.isArray(service_type)) {
      const uniqueServices = [...new Set(service_type.filter(Boolean))];
      service_type = uniqueServices;
    }

    // First, get all user IDs where superior_id = loginUserId
    const subordinates = await User.findAll({
      where: {
        superior_id: loginUserId,
        is_active: true,
        member_type: "volunteer_member",
        status: "approved"
      },
      attributes: ['id']
    });

    const subordinateIds = subordinates.map(sub => sub.id);

    if (subordinateIds.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        message: "No volunteers assigned to you",
        filters: { issue_type, category, location, search, min_experience, max_experience, service_type },
        data: []
      });
    }

    // Build where conditions
    const whereConditions = {
      id: {
        [Op.in]: subordinateIds  // Only show volunteers where superior_id = loginUserId
      },
      is_active: true,
      member_type: "volunteer_member",
      status: "approved"
    };

    // STRICT FILTERING - Required field for volunteers
    if (!issue_type || !issue_type.trim()) {
      return res.status(400).json({
        success: false,
        message: "issue_type is required",
        data: []
      });
    }

    // UPDATED MAPPING - Based on your actual database values
    const categoryMapping = {
      'Medical Facility': ['Healthcare', 'Medical', 'General'],
      'Medical Camp': ['Healthcare', 'Medical Camps', 'General'],
      'Healthcare': ['Healthcare', 'Medical', 'General'],
      'Legal Aid': ['Legal Aid', 'Legal', 'Retired Bank Officer'],
      'Legal Awareness': ['Legal Aid', 'Legal', 'Retired Bank Officer'],
      'Education': ['Education', 'Student', 'Teaching', 'Homemaker'],
      'Digital Literacy': ['IT', 'Technology', 'Student'],
      'Financial Literacy': ['Finance', 'Banking', 'Retired Bank Officer', 'Small Business Owner'],
      'Housing': ['Housing', 'Small Business Owner', 'General'],
      'Women Empowerment': ['Social Worker', 'Social Service', 'Homemaker'],
      'Senior Citizens': ['Old Age Care', 'Social Service', 'Retired Bank Officer'],
      'Environment': ['Social Service', 'General'],
      'Business Development': ['Small Business Owner', 'Business', 'General'],
      'Agriculture': ['Agriculture', 'Farming', 'General'],
      'Community Service': ['Social Service', 'Social Worker', 'General'],
      'Infrastructure': ['Infrastructure', 'General'],
      'Public Safety': ['Safety', 'Security', 'General'],
      'Blood Donation': ['Healthcare', 'Medical', 'General']
    };

    const allowedCategories = categoryMapping[issue_type] || [];

    if (allowedCategories.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid issue_type provided",
        data: []
      });
    }

    // Filter by category
    whereConditions.category = {
      [Op.in]: allowedCategories
    };

    // =========================
    // SERVICE TYPE FILTERING (Optional - only if provided)
    // =========================
    if (service_type && service_type.length > 0) {
      const serviceTypeArray = Array.isArray(service_type) ? service_type : [service_type];
      
      const serviceConditions = serviceTypeArray.map(service => ({
        service_type: { [Op.like]: `%${service}%` }
      }));
      
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ [Op.or]: serviceConditions });
      } else {
        whereConditions[Op.and] = [{ [Op.or]: serviceConditions }];
      }
    }

    // Additional filters
    if (category && category.trim()) {
      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push({ category: { [Op.like]: `%${category}%` } });
      } else {
        whereConditions.category = { [Op.like]: `%${category}%` };
      }
    }

    if (location && location.trim()) {
      const locationCondition = {
        [Op.or]: [
          { city: { [Op.like]: `%${location}%` } },
          { district: { [Op.like]: `%${location}%` } },
          { state: { [Op.like]: `%${location}%` } }
        ]
      };

      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(locationCondition);
      } else {
        whereConditions[Op.and] = [locationCondition];
      }
    }

    if (search && search.trim()) {
      const searchCondition = {
        [Op.or]: [
          { full_name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
          { mobile_1: { [Op.like]: `%${search}%` } },
          { profession: { [Op.like]: `%${search}%` } }
        ]
      };

      if (whereConditions[Op.and]) {
        whereConditions[Op.and].push(searchCondition);
      } else {
        whereConditions[Op.and] = [searchCondition];
      }
    }

    if (min_experience || max_experience) {
      const experienceCondition = {};
      if (min_experience) experienceCondition[Op.gte] = parseInt(min_experience);
      if (max_experience) experienceCondition[Op.lte] = parseInt(max_experience);
      whereConditions.years_of_experience = experienceCondition;
    }

    console.log("Executing query for user:", loginUserId);
    console.log("Subordinate IDs:", subordinateIds);
    console.log("Query conditions:", JSON.stringify(whereConditions, null, 2));

    // Execute query
    const users = await User.findAll({
      where: whereConditions,
      attributes: [
        'id',
        'full_name',
        'parents_name',
        'member_type',
        'category',
        'service_type',
        'blood_group',
        'date_of_birth',
        'age',
        'years_of_experience',
        'organization',
        'profession',
        'business_description',
        'address',
        'booth_no',
        'taluk_zone',
        'city',
        'district',
        'state',
        'pin_code',
        'ls_sabha',
        'vs_sabha',
        'mobile_1',
        'mobile_2',
        'phone_1',
        'phone_2',
        'email',
        'status',
        'is_active',
        'remark',
        'document_file',
        'photo',
        'created_at',
        'updated_at',
        'superior_id'  // Include superior_id in response for verification
      ],
      order: [
        ['years_of_experience', 'DESC'],
        ['full_name', 'ASC']
      ],
    });

    // Format response
    const formatted = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      member_type: user.member_type,
      category: user.category || 'N/A',
      service_type: user.service_type || 'N/A',
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
      created_at: user.created_at,
      updated_at: user.updated_at,
      superior_id: user.superior_id
    }));

    return res.status(200).json({
      success: true,
      count: formatted.length,
      filters: { issue_type, category, location, search, min_experience, max_experience, service_type },
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
// GET ACTIVE USERS
// =========================
export const getActiveUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        is_active: true,
        status: "approved"
      },
      order: [["full_name", "ASC"]],
    });

    const formatted = users.map((user) => ({
      id: user.id,
      full_name: user.full_name,
      parents_name: user.parents_name,
      category: user.category,
      blood_group: user.blood_group,
      date_of_birth: user.date_of_birth,
      age: user.age,
      years_of_experience: user.years_of_experience,
      service_type: user.service_type, // Added new field
      voter_id: user.voter_id,
      aadhaar_number: user.aadhaar_number,
      organization: user.organization,
      profession: user.profession,
      business_description: user.business_description,
      address: user.address,
      booth_no: user.booth_no,
      taluk_zone: user.taluk_zone,
      city: user.city,
      district: user.district,
      state: user.state,
      pin_code: user.pin_code,
      ls_sabha: user.ls_sabha,
      vs_sabha: user.vs_sabha,
      mobile_1: user.mobile_1,
      mobile_2: user.mobile_2,
      phone_1: user.phone_1,
      phone_2: user.phone_2,
      email: user.email,
      status: user.status,
      is_active: user.is_active,
      remark: user.remark,
      document_file: user.document_file,
      photo: user.photo,
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

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.status(200).json({
      success: true,
      data: formatUserResponse(user)
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching user",
      error: error.message
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

    // Validate service type
    if (
      updateData.member_type === "volunteer_member" &&
      updateData.service_type === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Service type is required for volunteer members",
      });
    }

    // Clear service_type for non-volunteer members
    if (
      updateData.member_type &&
      updateData.member_type !== "volunteer_member"
    ) {
      updateData.service_type = null;
    }

    // Parse address JSON
    if (
      updateData.address &&
      typeof updateData.address === "string"
    ) {
      try {
        updateData.address = JSON.parse(updateData.address);
      } catch (error) {
        console.error("Error parsing address:", error);
        updateData.address = {};
      }
    }

    // Auto status handling
    if (updateData.is_active !== undefined) {
      const isActive =
        updateData.is_active === true ||
        updateData.is_active === 1 ||
        updateData.is_active === "1";

      if (isActive && updateData.status !== "approved") {
        updateData.status = "approved";
      }
    }

    // Password update
    if (updateData.password) {
      updateData.password = await bcrypt.hash(
        updateData.password,
        10
      );
    } else {
      delete updateData.password;
    }

    // File uploads
    if (req.files) {
      if (req.files.document_file) {
        updateData.document_file =
          req.files.document_file[0].filename;
      }

      if (req.files.photo) {
        updateData.photo =
          req.files.photo[0].filename;
      }

      if (req.files.aadhaar_photo) {
        updateData.aadhaar_photo =
          req.files.aadhaar_photo[0].filename;
      }

      if (req.files.voter_photo) {
        updateData.voter_photo =
          req.files.voter_photo[0].filename;
      }
    }

    // Auto calculate age
    if (
      updateData.date_of_birth &&
      !updateData.age
    ) {
      updateData.age = calculateAge(
        updateData.date_of_birth
      );
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
    const { status, remark } = req.body;

    // =========================
    // VALIDATION
    // =========================
    if (
      !status ||
      !["pending", "approved", "rejected"].includes(status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid status (pending/approved/rejected) is required"
      });
    }

    // =========================
    // FIND USER
    // =========================
    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    // =========================
    // UPDATE STATUS
    // =========================
    const isActive = status === "approved";

    await user.update({
      status,
      is_active: isActive,
      remark: remark || user.remark,
      updated_at: new Date()
    });

    // =========================
    // NOTIFICATION MESSAGE
    // =========================
    let notificationMessage = "";
    let notificationMessage1 = "";

    let emailSubject = "";
    let emailHtml = "";

    if (status === "approved") {
      notificationMessage = `Dear ${user.full_name}, Great news! Your registration request has been APPROVED. You can now login to your account using your registered email and password at https://edigacommunity.innogenx.co.in/login`;
      notificationMessage1 = `Dear ${user.full_name}, Great news! Your registration request has been APPROVED.`;

      emailSubject = "🎉 Registration Approved - Welcome to Ediga Community!";

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .content {
                    background: #f9fafb;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                }
                .credentials {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #10b981;
                }
                .button {
                    display: inline-block;
                    background: #10b981;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                }
                .notes {
                    background: #fef3c7;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #f59e0b;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #6b7280;
                }
                .highlight {
                    color: #10b981;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Account Approved! 🎉</h1>
                <p>Welcome to Ediga Community</p>
            </div>
            
            <div class="content">
                <p>Dear <strong>${user.full_name}</strong>,</p>
                
                <p>Great news! Your registration request has been <strong class="highlight">APPROVED</strong> by the admin. 🎉</p>
                
                <p>You can now log in to your account and start exploring the Ediga Community platform.</p>
                
                <div class="credentials">
                    <h3 style="margin-top: 0;">🔐 Your Login Credentials:</h3>
                    <p><strong>📧 Email:</strong> ${user.email}</p>
                    <p><strong>🔑 Password:</strong> The password you set during registration</p>
                </div>
                
                <center>
                    <a href="https://edigacommunity.innogenx.co.in/login" class="button">
                        🔐 Click Here to Login
                    </a>
                </center>
                
                <p><strong>🌐 Login Link:</strong><br>
                <code style="background: #f3f4f6; padding: 8px; display: block; word-break: break-all; border-radius: 4px;">
                    https://edigacommunity.innogenx.co.in/login
                </code>
                </p>
                
                <div class="notes">
                    <h3 style="margin-top: 0;">⚠️ Important Notes:</h3>
                    <ul style="margin-bottom: 0;">
                        <li>Keep your credentials safe and secure</li>
                        <li>You can change your password after logging in</li>
                        <li>For any login issues, please contact support</li>
                    </ul>
                </div>
                
                <p>Thank you for joining Ediga Community! We're excited to have you onboard.</p>
                
                <p>Best regards,<br>
                <strong>Ediga Community Team</strong></p>
            </div>
            
            <div class="footer">
                <p>© 2025 Ediga Community. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
            </div>
        </body>
        </html>
      `;

    } else if (status === "rejected") {
      notificationMessage = `Dear ${user.full_name}, We regret to inform you that your registration request has been rejected. ${remark ? `Reason: ${remark}` : 'Please contact support for more information.'} You can re-apply after addressing the issues or contact our support team for assistance.`;

      emailSubject = "Registration Status Update - Ediga Community";

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .content {
                    background: #f9fafb;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                }
                .remark {
                    background: white;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #ef4444;
                }
                .next-steps {
                    background: #e0f2fe;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    border-left: 4px solid #0284c7;
                }
                .button {
                    display: inline-block;
                    background: #3b82f6;
                    color: white;
                    padding: 12px 24px;
                    text-decoration: none;
                    border-radius: 6px;
                    margin: 20px 0;
                }
                .support {
                    background: #f3f4f6;
                    padding: 15px;
                    border-radius: 8px;
                    margin: 20px 0;
                    text-align: center;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #6b7280;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Registration Update</h1>
                <p>Application Status: Rejected</p>
            </div>
            
            <div class="content">
                <p>Dear <strong>${user.full_name}</strong>,</p>
                
                <p>Thank you for your interest in joining <strong>Ediga Community</strong>. After careful review of your application, we regret to inform you that your registration request has been <strong style="color: #ef4444;">REJECTED</strong> at this time.</p>
                
                ${remark ? `
                <div class="remark">
                    <h3 style="margin-top: 0;">📝 Reason for Rejection:</h3>
                    <p style="margin-bottom: 0; font-size: 14px;">${remark}</p>
                </div>
                ` : `
                <div class="remark">
                    <h3 style="margin-top: 0;">📝 Reason for Rejection:</h3>
                    <p style="margin-bottom: 0; font-size: 14px;">Your application did not meet the eligibility criteria or required documentation was incomplete.</p>
                </div>
                `}
                
                <div class="next-steps">
                    <h3 style="margin-top: 0;">🔄 Next Steps You Can Take:</h3>
                    <ul style="margin-bottom: 0;">
                        <li>Review the reason for rejection mentioned above</li>
                        <li>Update your information and documentation</li>
                        <li>Contact our support team for clarification</li>
                    </ul>
                </div>
                
                <div class="support">
                    <h3 style="margin-top: 0;">📞 Need Help?</h3>
                    <p>If you believe this decision was made in error or need assistance with your application, please don't hesitate to contact our support team.</p>
                    <p><strong>Email:</strong> support@edigacommunity.org<br>
                    <strong>Phone:</strong> +91 XXXXXXXXXX</p>
                </div>
                
                <center>
                    <a href="https://edigacommunity.innogenx.co.in/register" class="button">
                        🔄 Re-apply for Registration
                    </a>
                </center>
                
                <hr style="margin: 20px 0;">
                
                <p><strong>Important Information:</strong></p>
                <ul>
                    <li>You can re-apply at any time with updated information</li>
                    <li>Previous application data has been saved for reference</li>
                    <li>Contact support within 30 days if you need clarification</li>
                </ul>
                
                <p>We appreciate your interest in joining our community and encourage you to address the mentioned issues and re-apply.</p>
                
                <p>Best regards,<br>
                <strong>Ediga Community Team</strong></p>
            </div>
            
            <div class="footer">
                <p>© 2025 Ediga Community. All rights reserved.</p>
                <p>This is an automated message, please do not reply directly to this email.</p>
                <p>For assistance, please contact: support@edigacommunity.org</p>
            </div>
        </body>
        </html>
      `;

    } else {
      notificationMessage = `Dear ${user.full_name}, Your registration status has been updated to ${status}. Please check your dashboard for more details.`;

      emailSubject = "Registration Status Updated - Ediga Community";

      emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }
                .header {
                    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
                    color: white;
                    padding: 30px;
                    text-align: center;
                    border-radius: 10px 10px 0 0;
                }
                .content {
                    background: #f9fafb;
                    padding: 30px;
                    border-radius: 0 0 10px 10px;
                    border: 1px solid #e5e7eb;
                    border-top: none;
                }
                .footer {
                    text-align: center;
                    margin-top: 20px;
                    font-size: 12px;
                    color: #6b7280;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>Registration Status Updated</h1>
            </div>
            
            <div class="content">
                <p>Dear <strong>${user.full_name}</strong>,</p>
                
                <p>Your registration status has been updated to <strong>${status.toUpperCase()}</strong>.</p>
                
                <p>Please log in to your dashboard for more details.</p>
                
                <p>Best regards,<br>
                <strong>Ediga Community Team</strong></p>
            </div>
            
            <div class="footer">
                <p>© 2025 Ediga Community. All rights reserved.</p>
                <p>This is an automated message, please do not reply.</p>
            </div>
        </body>
        </html>
      `;
    }

    // =========================
    // CREATE NOTIFICATION
    // =========================
    await Notification.create({
      user_id: user.id,
      message: notificationMessage1,
      message_type: status === "approved" ? "registration_approved" : status,
      is_read: 0,
      detail: {
        user_id: user.id,
        full_name: user.full_name,
        email: user.email,
        status,
        remark: remark || "",
        login_url: "https://edigacommunity.innogenx.co.in/login",
        reapply_url: "https://edigacommunity.innogenx.co.in/register",
        support_email: "support@edigacommunity.org"
      },
      photo: "bell-icon.webp"
    });

    // =========================
    // SEND EMAIL
    // =========================
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: `"Ediga Community" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: emailSubject,
      html: emailHtml
    });

    // =========================
    // RESPONSE
    // =========================
    res.status(200).json({
      success: true,
      message: `User ${status} successfully`,
      data: user
    });

  } catch (error) {

    console.error("Error updating user status:", error);

    res.status(500).json({
      success: false,
      message: "Error updating user status",
      error: error.message
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

    const user = await User.findOne({ where: { email } });
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

// =========================
// RESET PASSWORD
// =========================
export const resetPassword = async (req, res) => {
  try {
    const { token, new_password } = req.body;

    if (!token || !new_password) {
      return res.status(400).json({
        success: false,
        message: "Token and new password required"
      });
    }

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
        message: "Token invalid or expired"
      });
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await user.update({
      password: hashedPassword,
      reset_token: null,
      reset_token_expiry: null,
      updated_at: new Date()
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully"
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
// GET STATISTICS
// =========================
export const getUserStats = async (req, res) => {
  try {
    const totalUsers = await User.count();
    const approvedUsers = await User.count({ where: { status: 'approved' } });
    const pendingUsers = await User.count({ where: { status: 'pending' } });
    const rejectedUsers = await User.count({ where: { status: 'rejected' } });
    const activeUsers = await User.count({ where: { is_active: true } });

    // Statistics by service type for volunteer members
    const serviceTypeStats = await User.findAll({
      attributes: ['service_type', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      where: {
        member_type: 'volunteer_member',
        service_type: { [Op.ne]: null }
      },
      group: ['service_type']
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
        by_service_type: serviceTypeStats, // Added service type statistics
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