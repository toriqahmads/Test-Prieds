const { body } = require('express-validator');

const validations = () => {
    return [
        body('company_id')
            .exists()
            .notEmpty()
            .isString()
            .escape()
            .withMessage('company_id should not empty'),
        body('payload')
            .exists()
            .notEmpty()
            .isString()
            .escape()
            .withMessage('payload should not empty'),
        body('reject_qr_list')
            .exists()
            .isArray()
            .withMessage('reject_qr_list should not empty'),
        body('reject_qr_list.*.payload')
            .isString()
            .withMessage('value of reject_qr_list should be object containing payload key and string value'),
        body('new_qr_list')
            .exists()
            .isArray()
            .withMessage('new_qr_list should not empty'),
        body('new_qr_list.*.payload')
            .isString()
            .withMessage('value of new_qr_list should be object containing payload key and string value')
    ]
}

module.exports = validations;