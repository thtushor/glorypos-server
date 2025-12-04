
'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('PayrollFines', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      salaryMonth: {
        type: Sequelize.STRING, // Format: "YYYY-MM"
        allowNull: false,
        comment: "Salary month for which fine is applied",
      },
      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
    // Add indexes for faster lookups
    await queryInterface.addIndex('PayrollFines', ['userId']);
    await queryInterface.addIndex('PayrollFines', ['salaryMonth']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('PayrollFines');
  }
};
