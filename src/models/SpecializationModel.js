export default (sequelize, DataTypes) => {
    const Specialization = sequelize.define(
        "Specialization",
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },

            profession_id: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },

            specialization_name: {
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
            tableName: "specializations",
            timestamps: false,
        }
    );

   Specialization.associate = (models) => {
  Specialization.belongsTo(models.Profession, {
    foreignKey: "profession_id",
    as: "profession",
  });

  Specialization.hasMany(models.User, {
    foreignKey: "specialization_id",
    as: "users",
  });
};

    return Specialization;
};