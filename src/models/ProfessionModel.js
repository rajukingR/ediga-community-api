export default (sequelize, DataTypes) => {
    const Profession = sequelize.define(
        "Profession",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            sub_category_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            profession_name: {
                type: DataTypes.STRING,
                allowNull: false,
            },

            description: {
                type: DataTypes.TEXT,
                allowNull: true,
            },

            is_active: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },

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
            tableName: "professions",
            timestamps: false,
        }
    );

   Profession.associate = (models) => {
  Profession.belongsTo(models.SubCategory, {
    foreignKey: "sub_category_id",
    as: "sub_category",
  });

  Profession.hasMany(models.Specialization, {
    foreignKey: "profession_id",
    as: "specializations",
  });

  Profession.hasMany(models.User, {
    foreignKey: "profession_id",
    as: "users",
  });
};

    return Profession;
};