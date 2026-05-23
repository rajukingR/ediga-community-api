export default (sequelize, DataTypes) => {
    const Member = sequelize.define(
        "Member",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            // ======================
            // BASIC INFO
            // ======================
            member_id: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
            },

            name: {
                type: DataTypes.STRING(150),
                allowNull: false,
            },

            dob: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            age: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },

            email: {
                type: DataTypes.STRING(150),
                allowNull: true,
                unique: true,
                validate: {
                    isEmail: true,
                },
            },

            mobile_number: {
                type: DataTypes.STRING(15),
                allowNull: false,
                unique: true,
            },

            password_hash: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            profile_image: {
                type: DataTypes.STRING(255),
            },

            // ======================
            // PERSONAL INFO
            // ======================
            blood_group: {
                type: DataTypes.STRING(5),
            },

            gender: {
                type: DataTypes.ENUM("Male", "Female", "Other"),
            },

            profession: {
                type: DataTypes.STRING(150),
            },

            organisation: {
                type: DataTypes.STRING(150),
            },

            // ======================
            // ADDRESS (JSON)
            // ======================
            address: {
                type: DataTypes.JSON,
                allowNull: true,
            },

            // ======================
            // IDENTIFICATION
            // ======================
            id_no: {
                type: DataTypes.STRING(50),
                unique: true,
            },

            aadhar_number: {
                type: DataTypes.STRING(20),
                unique: true,
            },

            // ======================
            // MEMBERSHIP
            // ======================
            membership_type: {
                type: DataTypes.ENUM("free", "paid", "vip"),
                defaultValue: "free",
            },

            payment_amount: {
                type: DataTypes.DECIMAL(10, 2),
                defaultValue: 0,
            },

            transaction_id: {
                type: DataTypes.STRING(255),
                allowNull: true,
            },

            payment_status: {
                type: DataTypes.ENUM("Pending", "Paid", "Failed"),
                defaultValue: "Pending",
            },

            membership_valid_from: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            membership_valid_till: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },

            // ======================
            // EXTRA
            // ======================
            description: {
                type: DataTypes.TEXT,
            },

            notes: {
                type: DataTypes.TEXT,
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },

            // ======================
            // AUDIT
            // ======================
            created_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },

            updated_at: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
            },
        },
        {
            tableName: "members",
            timestamps: false,

            hooks: {
                beforeUpdate: (member) => {
                    member.updated_at = new Date();
                },
            },
        }
    );

    Member.associate = (models) => {
        // Example future relations
        // Member.belongsTo(models.User, {
        //     foreignKey: "superior_id",
        //     as: "superior",
        // });
    };

    return Member;
};