export default (sequelize, DataTypes) => {
  const User = sequelize.define(
    "User",
    {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },

      member_id: {
        type: DataTypes.STRING(50),
        unique: true,
        allowNull: true,
      },

      full_name: {
        type: DataTypes.STRING(100),
      },

      member_type_id: {
        type: DataTypes.INTEGER,
      },

      category_id: {
        type: DataTypes.INTEGER,
      },

      sub_category_id: {
        type: DataTypes.INTEGER,
      },

      specialization_id: {
        type: DataTypes.INTEGER,
      },

      blood_group: {
        type: DataTypes.STRING(10),
      },

      dob: {
        type: DataTypes.DATEONLY,
      },

      age: {
        type: DataTypes.INTEGER,
      },

      parent_name: {
        type: DataTypes.STRING(255),
      },

      aadhar_no: {
        type: DataTypes.STRING(20),
      },

      voter_id_no: {
        type: DataTypes.STRING(20),
      },

      contact_person: {
        type: DataTypes.STRING(100),
      },

      organisation: {
        type: DataTypes.STRING(255),
      },

      profession_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },

      address: {
        type: DataTypes.JSON,
        allowNull: true,
      },

      booth_no: {
        type: DataTypes.STRING(50),
      },

      pin_code: {
        type: DataTypes.STRING(10),
      },

      city: {
        type: DataTypes.STRING(100),
      },

      district: {
        type: DataTypes.STRING(100),
      },

      state: {
        type: DataTypes.STRING(100),
      },

      ls_sabha_mp: {
        type: DataTypes.STRING(255),
      },

      ls_code: {
        type: DataTypes.STRING(20),
      },

      vs_sabha_mla: {
        type: DataTypes.STRING(255),
      },

      vs_code: {
        type: DataTypes.STRING(20),
      },

      panchayat: {
        type: DataTypes.STRING(255),
      },

      ward: {
        type: DataTypes.STRING(100),
      },

      mobile1: {
        type: DataTypes.STRING(20),
      },

      mobile2: {
        type: DataTypes.STRING(20),
      },

      other_phone: {
        type: DataTypes.STRING(20),
      },

      phone1_office: {
        type: DataTypes.STRING(20),
      },

      phone2_office: {
        type: DataTypes.STRING(20),
      },

      phone_residence: {
        type: DataTypes.STRING(20),
      },

      email1: {
        type: DataTypes.STRING(255),
      },

      email2: {
        type: DataTypes.STRING(255),
      },

      password: {
        type: DataTypes.STRING(255),
      },

      otp_code: {
        type: DataTypes.STRING(10),
        allowNull: true,
        defaultValue: null
      },
      otp_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null
      },

      reset_token: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },

      reset_token_expiry: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      website: {
        type: DataTypes.STRING(255),
      },

      remark: {
        type: DataTypes.TEXT,
      },

      document_file: {
        type: DataTypes.STRING(255),
      },

      voter_document_file: {
        type: DataTypes.STRING(255),
      },

      aadhar_document_file: {
        type: DataTypes.STRING(255),
      },

      member_photo: {
        type: DataTypes.STRING(255),
      },

      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      status: {
        type: DataTypes.ENUM("Pending", "Approved", "Rejected"),
        defaultValue: "Pending",
      },

      created_at: {
        type: DataTypes.DATE,
      },

      updated_at: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "users",
      timestamps: false,
    }
  );

  User.associate = (models) => {
    // Existing association
    User.belongsTo(models.MemberType, {
      foreignKey: "member_type_id",
      as: "memberType",
    });

    // Add Category association
    User.belongsTo(models.Category, {
      foreignKey: "category_id",
      as: "category",
    });

    // Add SubCategory association
    User.belongsTo(models.SubCategory, {
      foreignKey: "sub_category_id",
      as: "sub_category",
    });

    // Profession
    User.belongsTo(models.Profession, {
      foreignKey: "profession_id",
      as: "profession",
    });

    // Add Specialization association
    User.belongsTo(models.Specialization, {
      foreignKey: "specialization_id",
      as: "specialization",
    });
  };

  return User;
};