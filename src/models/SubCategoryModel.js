export default (sequelize, DataTypes) => {
    const SubCategory = sequelize.define(
        "SubCategory",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            category_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            sub_category_name: {
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
            tableName: "sub_categories",
            timestamps: false,
        }
    );

   SubCategory.associate = (models) => {
  SubCategory.belongsTo(models.Category, {
    foreignKey: "category_id",
    as: "category",
  });

  SubCategory.hasMany(models.Profession, {
    foreignKey: "sub_category_id",
    as: "professions",
  });

  SubCategory.hasMany(models.User, {
    foreignKey: "sub_category_id",
    as: "users",
  });
};

    return SubCategory;
};